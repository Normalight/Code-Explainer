package com.codeexplainer.service;

import com.codeexplainer.model.Project;
import com.codeexplainer.model.ProjectFile;
import com.codeexplainer.repository.ProjectFileRepository;
import com.codeexplainer.repository.ProjectRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.ai.autoconfigure.vectorstore.chroma.ChromaVectorStoreAutoConfiguration;
import org.springframework.boot.autoconfigure.EnableAutoConfiguration;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.context.ActiveProfiles;

import java.io.ByteArrayInputStream;
import java.io.File;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.zip.ZipEntry;
import java.util.zip.ZipOutputStream;

import static org.junit.jupiter.api.Assertions.*;

@SpringBootTest
@EnableAutoConfiguration(exclude = {ChromaVectorStoreAutoConfiguration.class})
@ActiveProfiles("test")
class FileServiceTest {

    @Autowired
    private FileService fileService;

    @Autowired
    private ProjectRepository projectRepository;

    @Autowired
    private ProjectFileRepository projectFileRepository;

    @TempDir
    Path tempDir;

    @BeforeEach
    void cleanUp() {
        projectFileRepository.deleteAll();
        projectRepository.deleteAll();
    }

    private byte[] createTestZip(String... entries) throws Exception {
        var baos = new java.io.ByteArrayOutputStream();
        var zos = new ZipOutputStream(baos);
        for (var entry : entries) {
            zos.putNextEntry(new ZipEntry(entry));
            zos.write("sample content".getBytes());
            zos.closeEntry();
        }
        zos.close();
        return baos.toByteArray();
    }

    @Test
    void uploadZip_createsProjectAndExtractsFiles() throws Exception {
        var zipBytes = createTestZip(
                "src/main.py",
                "src/utils.py",
                "README.md"
        );
        var file = new MockMultipartFile("file", "my-project.zip", "application/zip", zipBytes);

        var project = fileService.uploadZip(file, tempDir.toString());

        assertNotNull(project.getId());
        assertEquals("my-project", project.getName());
        assertNotNull(project.getUploadTime());

        var files = projectFileRepository.findByProject(project);
        assertEquals(3, files.size());
        assertTrue(files.stream().anyMatch(f -> f.getPath().equals("src/main.py")));
        assertTrue(files.stream().anyMatch(f -> f.getPath().equals("src/utils.py")));
        assertTrue(files.stream().anyMatch(f -> f.getPath().equals("README.md")));
    }

    @Test
    void uploadZip_detectsLanguageFromExtension() throws Exception {
        var zipBytes = createTestZip("app.py", "index.js", "config.yaml");
        var file = new MockMultipartFile("file", "test.zip", "application/zip", zipBytes);

        var project = fileService.uploadZip(file, tempDir.toString());
        var files = projectFileRepository.findByProject(project);

        var pyFile = files.stream().filter(f -> f.getPath().equals("app.py")).findFirst().orElseThrow();
        assertEquals("Python", pyFile.getLanguage());

        var jsFile = files.stream().filter(f -> f.getPath().equals("index.js")).findFirst().orElseThrow();
        assertEquals("JavaScript", jsFile.getLanguage());

        var yamlFile = files.stream().filter(f -> f.getPath().equals("config.yaml")).findFirst().orElseThrow();
        assertEquals("YAML", yamlFile.getLanguage());
    }

    @Test
    void uploadZip_countsLines() throws Exception {
        var baos = new java.io.ByteArrayOutputStream();
        var zos = new ZipOutputStream(baos);
        zos.putNextEntry(new ZipEntry("main.py"));
        zos.write("line1\nline2\nline3".getBytes());
        zos.closeEntry();
        zos.close();

        var file = new MockMultipartFile("file", "test.zip", "application/zip", baos.toByteArray());
        var project = fileService.uploadZip(file, tempDir.toString());
        var files = projectFileRepository.findByProject(project);

        assertEquals(3, files.get(0).getLineCount());
    }

    @Test
    void getFileTree_returnsHierarchicalStructure() throws Exception {
        var zipBytes = createTestZip("src/main.py", "src/utils.py", "README.md");
        var file = new MockMultipartFile("file", "test.zip", "application/zip", zipBytes);
        var project = fileService.uploadZip(file, tempDir.toString());

        var tree = fileService.getFileTree(project.getId());

        assertNotNull(tree);
        assertEquals("test", tree.name());
        assertTrue(tree.children().size() >= 2);

        var srcDir = tree.children().stream()
                .filter(n -> n.name().equals("src"))
                .findFirst().orElseThrow();
        assertEquals("directory", srcDir.type());
        assertEquals(2, srcDir.children().size());
    }

    @Test
    void getFileContent_returnsFileContent() throws Exception {
        var baos = new java.io.ByteArrayOutputStream();
        var zos = new ZipOutputStream(baos);
        zos.putNextEntry(new ZipEntry("hello.py"));
        zos.write("print('hello')".getBytes());
        zos.closeEntry();
        zos.close();

        var file = new MockMultipartFile("file", "test.zip", "application/zip", baos.toByteArray());
        var project = fileService.uploadZip(file, tempDir.toString());

        var content = fileService.getFileContent(project.getId(), "hello.py");
        assertEquals("print('hello')", content);
    }

    @Test
    void getFileContent_throwsWhenFileNotFound() {
        var project = projectRepository.save(new Project(null, "test", java.time.LocalDateTime.now(), "/tmp/test", null, 0, 0, 0, null, null));

        assertThrows(RuntimeException.class, () -> fileService.getFileContent(project.getId(), "nonexistent.py"));
    }
}
