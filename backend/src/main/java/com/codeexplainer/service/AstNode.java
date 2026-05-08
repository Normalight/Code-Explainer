package com.codeexplainer.service;

import java.util.ArrayList;
import java.util.List;

public record AstNode(String type, String name, int startLine, List<AstNode> children) {
    public AstNode(String type, String name, int startLine) {
        this(type, name, startLine, new ArrayList<>());
    }
}
