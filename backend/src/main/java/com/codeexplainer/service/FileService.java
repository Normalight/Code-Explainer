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
import java.util.stream.Collectors;
import java.util.zip.ZipEntry;
import java.util.zip.ZipInputStream;

@Service
@RequiredArgsConstructor
public class FileService {

    private final ProjectRepository projectRepository;
    private final ProjectFileRepository projectFileRepository;

    private static final long MAX_FILE_SIZE = 500 * 1024 * 1024; // 500MB
    private static final long MAX_SINGLE_FILE_SIZE = 10 * 1024 * 1024; // 10MB per extracted file
    private static final int READ_BUFFER_SIZE = 8192;

    private static final Set<String> SKIP_EXTENSIONS = Set.of(
            "png", "jpg", "jpeg", "gif", "ico", "woff", "woff2", "ttf", "eot",
            "class", "jar", "pyc", "o", "so", "exe", "dll",
            "mp4", "mp3", "avi", "mov", "wmv", "flv", "webm",
            "tar", "gz", "7z", "rar", "bz2", "xz",
            "sqlite", "db", "h5", "hdf5", "parquet", "npy", "pkl", "pickle",
            "pdf", "doc", "docx", "xls", "xlsx", "ppt", "pptx",
            "zip", "war", "ear", "node", "wasm"
    );

    private static final Set<String> LARGE_TEXT_EXTENSIONS = Set.of(
            "csv", "tsv", "log", "txt"
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

        Path projectDir = Path.of(uploadDir, String.valueOf(System.currentTimeMillis()));
        Files.createDirectories(projectDir);

        int[] fileCount = {0};
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
                fileCount[0]++;
                zis.closeEntry();
            }
        }

        Project project = new Project();
        project.setName(projectName);
        project.setUploadTime(LocalDateTime.now());
        project.setZipPath(projectDir.toString());
        project = projectRepository.save(project);

        scanAndSaveFiles(project, projectDir.toFile(), projectDir.toString());

        return project;
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

    private void scanAndSaveFiles(Project project, File dir, String basePath) throws IOException {
        File[] children = dir.listFiles();
        if (children == null) return;

        for (File child : children) {
            if (child.isDirectory()) {
                scanAndSaveFiles(project, child, basePath);
            } else if (child.isFile() && !isHiddenOrBinary(child.getName())) {
                String relativePath = child.getAbsolutePath().substring(basePath.length() + 1);
                String content = Files.readString(child.toPath());
                String language = detectLanguage(child.getName());
                int lineCount = content.split("\n", -1).length;

                ProjectFile pf = new ProjectFile();
                pf.setProject(project);
                pf.setPath(relativePath);
                pf.setContentHash(hashContent(content));
                pf.setLanguage(language);
                pf.setLineCount(lineCount);
                projectFileRepository.save(pf);
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
        FileTreeNode root = new FileTreeNode(projectName, "directory", null, null, new ArrayList<>());

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
                            isFile ? null : new ArrayList<>()
                    );
                    current.children().add(child);
                }
                if (!isFile) {
                    current = child;
                }
            }
        }
        return root;
    }

    public String getFileContent(Long projectId, String filePath) {
        Project project = projectRepository.findById(projectId)
                .orElseThrow(() -> new RuntimeException("Project not found"));
        Path fullPath = Path.of(project.getZipPath(), filePath);
        if (!Files.exists(fullPath)) {
            throw new RuntimeException("File not found: " + filePath);
        }
        try {
            return Files.readString(fullPath);
        } catch (IOException e) {
            throw new RuntimeException("Failed to read file", e);
        }
    }

    public record FileTreeNode(
            String name,
            String type,
            String language,
            Integer lineCount,
            List<FileTreeNode> children
    ) {}
}
