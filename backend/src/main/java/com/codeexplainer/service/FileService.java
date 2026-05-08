package com.codeexplainer.service;

import com.codeexplainer.model.Project;
import com.codeexplainer.model.ProjectFile;
import com.codeexplainer.repository.ProjectFileRepository;
import com.codeexplainer.repository.ProjectRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.*;
import java.nio.file.Files;
import java.nio.file.Path;
import java.security.MessageDigest;
import java.time.LocalDateTime;
import java.util.*;
import java.util.concurrent.CompletableFuture;
import java.util.stream.Collectors;
import java.util.zip.ZipEntry;
import java.util.zip.ZipInputStream;

@Service
@RequiredArgsConstructor
public class FileService {

    private final ProjectRepository projectRepository;
    private final ProjectFileRepository projectFileRepository;
    private final RagService ragService;

    private static final long MAX_FILE_SIZE = 500 * 1024 * 1024;
    private static final long MAX_SINGLE_FILE_SIZE = 10 * 1024 * 1024;
    private static final int READ_BUFFER_SIZE = 8192;

    private static final Set<String> SKIP_EXTENSIONS = Set.of(
            "png", "jpg", "jpeg", "gif", "ico", "woff", "woff2", "ttf", "eot",
            "class", "jar", "pyc", "o", "so", "exe", "dll",
            "mp4", "mp3", "avi", "mov", "wmv", "flv", "webm",
            "tar", "gz", "7z", "rar", "bz2", "xz",
            "sqlite", "db", "h5", "hdf5", "parquet", "npy", "pkl", "pickle",
            "pdf", "doc", "docx", "xls", "xlsx", "ppt", "pptx",
            "zip", "war", "ear", "node", "wasm", "lock", "map", "min.js", "min.css"
    );

    private static final Set<String> SKIP_DIRECTORIES = Set.of(
            "node_modules", ".git", "__pycache__", ".idea", ".vs",
            "dist", "build", "target", "out", ".next", ".nuxt",
            "vendor", ".gradle", ".mvn", "venv", ".venv", "env",
            ".tox", ".mypy_cache", ".pytest_cache", "coverage",
            ".cache", ".sass-cache", "bin", "obj"
    );

    private static final Set<String> LARGE_TEXT_EXTENSIONS = Set.of(
            "csv", "tsv", "log", "txt"
    );

    private static final Set<String> SOURCE_CODE_EXTENSIONS = Set.of(
            "py", "js", "ts", "jsx", "tsx", "java", "go", "rs", "rb", "php",
            "c", "cpp", "h", "hpp", "cs", "swift", "kt", "scala", "sh", "bash",
            "sql", "vue", "svelte", "ex", "exs", "erl", "clj", "hs", "ml", "mli",
            "jl", "r", "R", "lua", "dart", "zig", "nim", "pl", "pm"
    );

    private static final Map<String, String> EXTENSION_LANGUAGE_MAP = Map.ofEntries(
            Map.entry("py", "Python"), Map.entry("js", "JavaScript"), Map.entry("ts", "TypeScript"),
            Map.entry("java", "Java"), Map.entry("go", "Go"), Map.entry("rs", "Rust"),
            Map.entry("rb", "Ruby"), Map.entry("php", "PHP"), Map.entry("c", "C"),
            Map.entry("cpp", "C++"), Map.entry("cs", "C#"), Map.entry("swift", "Swift"),
            Map.entry("kt", "Kotlin"), Map.entry("scala", "Scala"),
            Map.entry("yaml", "YAML"), Map.entry("yml", "YAML"), Map.entry("json", "JSON"),
            Map.entry("xml", "XML"), Map.entry("toml", "TOML"), Map.entry("ini", "INI"),
            Map.entry("md", "Markdown"), Map.entry("html", "HTML"), Map.entry("css", "CSS"),
            Map.entry("scss", "SCSS"), Map.entry("sql", "SQL"), Map.entry("sh", "Shell"),
            Map.entry("dockerfile", "Dockerfile")
    );

    public Project uploadZip(MultipartFile file, String uploadDir) throws IOException {
        if (file.getSize() > MAX_FILE_SIZE) {
            throw new IllegalArgumentException("File too large (max 500MB): " + formatSize(file.getSize()));
        }

        String projectName = file.getOriginalFilename();
        if (projectName != null && projectName.endsWith(".zip")) {
            projectName = projectName.substring(0, projectName.length() - 4);
        }

        Path projectDir = Path.of(uploadDir, String.valueOf(System.currentTimeMillis())).normalize();
        Files.createDirectories(projectDir);

        try (var zis = new ZipInputStream(new BufferedInputStream(file.getInputStream(), READ_BUFFER_SIZE))) {
            ZipEntry entry;
            while ((entry = zis.getNextEntry()) != null) {
                if (isDangerousEntry(entry.getName())) continue;
                if (entry.isDirectory()) {
                    Files.createDirectories(projectDir.resolve(entry.getName()));
                    continue;
                }

                Path targetPath = projectDir.resolve(entry.getName()).normalize();
                if (!targetPath.startsWith(projectDir)) continue;

                if (isLargeBinaryFile(entry.getName()) || LARGE_TEXT_EXTENSIONS.contains(getExtension(entry.getName()))) {
                    if (entry.getSize() > MAX_SINGLE_FILE_SIZE) {
                        zis.closeEntry();
                        continue;
                    }
                }

                Files.createDirectories(targetPath.getParent());
                try (OutputStream out = new BufferedOutputStream(Files.newOutputStream(targetPath), READ_BUFFER_SIZE)) {
                    byte[] buf = new byte[READ_BUFFER_SIZE];
                    int n;
                    long written = 0;
                    while ((n = zis.read(buf)) > 0) {
                        out.write(buf, 0, n);
                        written += n;
                        if (written > MAX_SINGLE_FILE_SIZE) {
                            out.close();
                            Files.deleteIfExists(targetPath);
                            break;
                        }
                    }
                }
                zis.closeEntry();
            }
        }

        Project project = new Project();
        project.setName(projectName);
        project.setUploadTime(LocalDateTime.now());
        project.setZipPath(projectDir.toString());
        project = projectRepository.save(project);

        scanAndSaveFiles(project, projectDir.toFile(), projectDir.toAbsolutePath().toString());
        indexProjectAsync(project, projectDir.toFile(), projectDir.toAbsolutePath().toString());

        return project;
    }

    public Project importFromGitHub(String repoUrl, String uploadDir) throws IOException, InterruptedException {
        String projectName = extractRepoName(repoUrl);

        Path projectDir = Path.of(uploadDir, String.valueOf(System.currentTimeMillis())).normalize();
        Files.createDirectories(projectDir);

        ProcessBuilder pb = new ProcessBuilder("git", "clone", "--depth", "100", repoUrl, projectDir.toString());
        pb.redirectErrorStream(true);
        Process process = pb.start();
        int exitCode = process.waitFor();
        if (exitCode != 0) {
            String output = new String(process.getInputStream().readAllBytes());
            throw new IOException("git clone failed: " + output);
        }

        Project project = new Project();
        project.setName(projectName);
        project.setUploadTime(LocalDateTime.now());
        project.setZipPath(projectDir.toString());
        project = projectRepository.save(project);

        scanAndSaveFiles(project, projectDir.toFile(), projectDir.toString());
        return project;
    }

    private String extractRepoName(String url) {
        String cleaned = url.replaceAll("/+$", "");
        int lastSlash = cleaned.lastIndexOf('/');
        String name = lastSlash >= 0 ? cleaned.substring(lastSlash + 1) : cleaned;
        return name.endsWith(".git") ? name.substring(0, name.length() - 4) : name;
    }

    public static boolean isDangerousEntry(String entryName) {
        if (entryName == null) return true;
        String normalized = entryName.replace('\\', '/');
        return normalized.startsWith("/") || normalized.contains("..") || normalized.contains("C:");
    }

    public static boolean isLargeBinaryFile(String name) {
        if (name == null) return false;
        String ext = getExtensionStatic(name);
        return SKIP_EXTENSIONS.contains(ext);
    }

    public static boolean isSourceCodeFile(String name) {
        if (name == null) return false;
        String lowerName = name.toLowerCase();
        if (lowerName.equals("dockerfile") || lowerName.equals("makefile") || lowerName.equals("rakefile")) return false;
        if (lowerName.endsWith(".min.js") || lowerName.endsWith(".min.css")) return false;
        String ext = getExtensionStatic(name);
        return SOURCE_CODE_EXTENSIONS.contains(ext);
    }

    private boolean shouldSkipDirectory(String dirName) {
        return SKIP_DIRECTORIES.contains(dirName) || dirName.startsWith(".");
    }

    private void scanAndSaveFiles(Project project, File dir, String basePath) throws IOException {
        File[] children = dir.listFiles();
        if (children == null) return;

        for (File child : children) {
            if (child.isDirectory()) {
                if (shouldSkipDirectory(child.getName())) continue;
                scanAndSaveFiles(project, child, basePath);
            } else if (child.isFile() && !isHiddenOrBinary(child.getName())) {
                String relativePath = child.getAbsolutePath().substring(basePath.length() + 1);
                try {
                    String content = Files.readString(child.toPath());
                    String language = detectLanguage(child.getName());
                    int lineCount = content.split("\n", -1).length;
                    boolean analyzable = isSourceCodeFile(child.getName());

                    ProjectFile pf = new ProjectFile();
                    pf.setProject(project);
                    pf.setPath(relativePath);
                    pf.setContentHash(hashContent(content));
                    pf.setLanguage(language);
                    pf.setLineCount(lineCount);
                    pf.setAnalyzable(analyzable);
                    projectFileRepository.save(pf);
                } catch (Exception ignored) {
                }
            }
        }
    }

    private boolean isHiddenOrBinary(String name) {
        return name.startsWith(".") || SKIP_EXTENSIONS.contains(getExtension(name));
    }

    private static String getExtensionStatic(String filename) {
        int dot = filename.lastIndexOf('.');
        return dot > 0 ? filename.substring(dot + 1).toLowerCase() : "";
    }

    private static String formatSize(long bytes) {
        if (bytes < 1024) return bytes + " B";
        if (bytes < 1024 * 1024) return String.format("%.1f KB", bytes / 1024.0);
        return String.format("%.1f MB", bytes / (1024.0 * 1024));
    }

    private String detectLanguage(String filename) {
        String name = filename.toLowerCase();
        if (name.equals("dockerfile")) return "Dockerfile";
        String ext = getExtension(name);
        return EXTENSION_LANGUAGE_MAP.getOrDefault(ext, ext.toUpperCase());
    }

    private String getExtension(String filename) {
        int dot = filename.lastIndexOf('.');
        return dot > 0 ? filename.substring(dot + 1).toLowerCase() : "";
    }

    private String hashContent(String content) {
        try {
            var digest = MessageDigest.getInstance("SHA-256");
            byte[] hash = digest.digest(content.getBytes());
            return Base64.getEncoder().encodeToString(hash);
        } catch (Exception e) {
            throw new RuntimeException(e);
        }
    }

    public FileTreeNode getFileTree(Long projectId) {
        Project project = projectRepository.findById(projectId)
                .orElseThrow(() -> new RuntimeException("Project not found"));
        List<ProjectFile> files = projectFileRepository.findByProject(project);
        return buildTree(project.getName(), files);
    }

    private FileTreeNode buildTree(String projectName, List<ProjectFile> files) {
        FileTreeNode root = new FileTreeNode(projectName, "directory", null, null, false, new ArrayList<>());

        for (ProjectFile pf : files) {
            String[] parts = pf.getPath().split("/");
            FileTreeNode current = root;

            for (int i = 0; i < parts.length; i++) {
                String part = parts[i];
                boolean isFile = (i == parts.length - 1);

                FileTreeNode child = current.children().stream()
                        .filter(n -> n.name().equals(part))
                        .findFirst()
                        .orElse(null);

                if (child == null) {
                    child = new FileTreeNode(
                            part,
                            isFile ? "file" : "directory",
                            isFile ? pf.getLanguage() : null,
                            isFile ? pf.getLineCount() : null,
                            isFile ? pf.getAnalyzable() : false,
                            isFile ? null : new ArrayList<>()
                    );
                    current.children().add(child);
                }
                if (!isFile) {
                    current = child;
                }
            }
        }

        sortTree(root);
        return root;
    }

    private void sortTree(FileTreeNode node) {
        if (node.children() == null) return;
        node.children().sort((a, b) -> {
            // Directories first, then files
            if (!a.type().equals(b.type())) {
                return a.type().equals("directory") ? -1 : 1;
            }
            return a.name().compareToIgnoreCase(b.name());
        });
        for (FileTreeNode child : node.children()) {
            sortTree(child);
        }
    }

    public String getFileContent(Long projectId, String filePath) {
        Project project = projectRepository.findById(projectId)
                .orElseThrow(() -> new RuntimeException("Project not found"));
        Path fullPath = Path.of(project.getZipPath(), filePath);
        if (!Files.exists(fullPath)) {
            throw new RuntimeException("File not found: " + filePath);
        }
        try {
            byte[] bytes = Files.readAllBytes(fullPath);
            return new String(bytes, java.nio.charset.StandardCharsets.UTF_8);
        } catch (IOException e) {
            throw new RuntimeException("Failed to read file", e);
        }
    }

    private void indexProjectAsync(Project project, File projectDir, String basePath) {
        if (!ragService.isAvailable()) return;
        CompletableFuture.runAsync(() -> {
            try {
                List<RagService.ProjectChunk> allChunks = new ArrayList<>();
                chunkAllFiles(projectDir, basePath, allChunks);
                if (!allChunks.isEmpty()) {
                    ragService.indexProject(project.getId(), allChunks);
                }
            } catch (Exception e) {
                // Log but don't fail upload
            }
        });
    }

    private void chunkAllFiles(File dir, String basePath, List<RagService.ProjectChunk> allChunks) throws IOException {
        File[] children = dir.listFiles();
        if (children == null) return;
        for (File child : children) {
            if (child.isDirectory()) {
                if (shouldSkipDirectory(child.getName())) continue;
                chunkAllFiles(child, basePath, allChunks);
            } else if (child.isFile() && !isHiddenOrBinary(child.getName())) {
                String relativePath = child.getAbsolutePath().substring(basePath.length() + 1);
                String language = detectLanguage(child.getName());
                try {
                    String content = Files.readString(child.toPath());
                    List<RagService.ProjectChunk> fileChunks = ragService.chunkFile(relativePath, language, content);
                    allChunks.addAll(fileChunks);
                } catch (Exception ignored) {}
            }
        }
    }

    public record FileTreeNode(
            String name,
            String type,
            String language,
            Integer lineCount,
            Boolean analyzable,
            List<FileTreeNode> children
    ) {}
}
