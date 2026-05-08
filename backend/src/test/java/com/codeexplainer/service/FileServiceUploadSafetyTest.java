package com.codeexplainer.service;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

class FileServiceUploadSafetyTest {

    @Test
    void sanitizeZipEntry_rejectsPathTraversal() {
        assertTrue(FileService.isDangerousEntry("../../../etc/passwd"));
        assertTrue(FileService.isDangerousEntry("foo/../../bar.txt"));
        assertTrue(FileService.isDangerousEntry("/absolute/path.txt"));
        assertTrue(FileService.isDangerousEntry("C:\\Windows\\system32"));
    }

    @Test
    void sanitizeZipEntry_allowsNormalPaths() {
        assertFalse(FileService.isDangerousEntry("src/main.py"));
        assertFalse(FileService.isDangerousEntry("README.md"));
        assertFalse(FileService.isDangerousEntry("a/b/c/d/e.txt"));
    }

    @Test
    void isLargeBinaryFile_detectsByExtension() {
        assertTrue(FileService.isLargeBinaryFile("video.mp4"));
        assertTrue(FileService.isLargeBinaryFile("archive.tar.gz"));
        assertTrue(FileService.isLargeBinaryFile("data.sqlite"));
        assertTrue(FileService.isLargeBinaryFile("model.h5"));
        assertTrue(FileService.isLargeBinaryFile("package.zip"));
    }

    @Test
    void isLargeBinaryFile_allowsCodeFiles() {
        assertFalse(FileService.isLargeBinaryFile("main.py"));
        assertFalse(FileService.isLargeBinaryFile("App.java"));
        assertFalse(FileService.isLargeBinaryFile("index.tsx"));
        assertFalse(FileService.isLargeBinaryFile("config.yaml"));
        assertFalse(FileService.isLargeBinaryFile("data.csv"));
    }
}
