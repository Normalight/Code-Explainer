package com.codeexplainer.service;

import java.util.ArrayList;
import java.util.List;

public record AstNode(String type, String name, int startLine, int endLine, List<AstNode> children) {
    public AstNode(String type, String name, int startLine) {
        this(type, name, startLine, startLine, new ArrayList<>());
    }
    public AstNode(String type, String name, int startLine, int endLine) {
        this(type, name, startLine, endLine, new ArrayList<>());
    }
}
