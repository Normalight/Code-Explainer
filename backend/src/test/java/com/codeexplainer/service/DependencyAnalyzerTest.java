package com.codeexplainer.service;

import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

class DependencyAnalyzerTest {

    @Test
    void parseImports_pythonFromImport() {
        String code = "from utils import helper\nfrom models.user import User\n";
        List<String> imports = DependencyAnalyzer.parseImports(code, "Python");

        assertEquals(2, imports.size());
        assertEquals("utils", imports.get(0));
        assertEquals("models.user", imports.get(1));
    }

    @Test
    void parseImports_pythonPlainImport() {
        String code = "import os\nimport sys\nimport numpy as np\n";
        List<String> imports = DependencyAnalyzer.parseImports(code, "Python");

        assertEquals(List.of("os", "sys", "numpy"), imports);
    }

    @Test
    void parseImports_javaImport() {
        String code = "import java.util.List;\nimport com.example.User;\n";
        List<String> imports = DependencyAnalyzer.parseImports(code, "Java");

        assertEquals(List.of("java.util.List", "com.example.User"), imports);
    }

    @Test
    void parseImports_jsEs6Import() {
        String code = "import React from 'react';\nimport { useState } from 'react';\nimport './utils';\nimport '../components/Button';\n";
        List<String> imports = DependencyAnalyzer.parseImports(code, "TypeScript");

        assertTrue(imports.contains("react"));
        assertTrue(imports.contains("./utils"));
        assertTrue(imports.contains("../components/Button"));
    }

    @Test
    void parseImports_goImport() {
        String code = "import (\n\t\"fmt\"\n\t\"github.com/gin-gonic/gin\"\n)\n";
        List<String> imports = DependencyAnalyzer.parseImports(code, "Go");

        assertEquals(2, imports.size());
        assertTrue(imports.contains("fmt"));
        assertTrue(imports.contains("github.com/gin-gonic/gin"));
    }

    @Test
    void parseImports_emptyCode_returnsEmpty() {
        List<String> imports = DependencyAnalyzer.parseImports("", "Python");
        assertTrue(imports.isEmpty());
    }

    @Test
    void parseImports_noImports_returnsEmpty() {
        String code = "x = 1\ny = 2\n";
        List<String> imports = DependencyAnalyzer.parseImports(code, "Python");
        assertTrue(imports.isEmpty());
    }

    @Test
    void resolveToFilePaths_matchesLocalFiles() {
        Map<String, String> projectFiles = Map.of(
                "utils/helper.py", "",
                "models/user.py", "",
                "main.py", ""
        );

        String result = DependencyAnalyzer.resolveImport("utils.helper", "Python", projectFiles);
        assertEquals("utils/helper.py", result);
    }

    @Test
    void resolveToFilePaths_jsRelativePath() {
        Map<String, String> projectFiles = Map.of(
                "src/components/Button.tsx", "",
                "src/utils.ts", "",
                "src/App.tsx", ""
        );

        String result = DependencyAnalyzer.resolveImport("./components/Button", "TypeScript", projectFiles, "src/App.tsx");
        assertEquals("src/components/Button.tsx", result);
    }

    @Test
    void resolveToFilePaths_noMatch_returnsNull() {
        Map<String, String> projectFiles = Map.of("main.py", "");
        String result = DependencyAnalyzer.resolveImport("nonexistent", "Python", projectFiles);
        assertNull(result);
    }

    @Test
    void resolveToFilePaths_stdLib_ignored() {
        Map<String, String> projectFiles = Map.of("main.py", "");
        String result = DependencyAnalyzer.resolveImport("os", "Python", projectFiles);
        assertNull(result);
    }
}
