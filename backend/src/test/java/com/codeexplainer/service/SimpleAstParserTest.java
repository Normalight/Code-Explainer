package com.codeexplainer.service;

import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

class SimpleAstParserTest {

    @Test
    void parse_pythonFunctions() {
        String code = "def hello():\n    pass\n\ndef greet(name):\n    return f'Hi {name}'\n";
        List<AstNode> nodes = SimpleAstParser.parse(code, "Python");

        assertEquals(2, nodes.size());
        assertEquals("function", nodes.get(0).type());
        assertEquals("hello", nodes.get(0).name());
        assertEquals(1, nodes.get(0).startLine());
        assertEquals("function", nodes.get(1).type());
        assertEquals("greet", nodes.get(1).name());
    }

    @Test
    void parse_pythonClass() {
        String code = "class Animal:\n    def speak(self):\n        pass\n";
        List<AstNode> nodes = SimpleAstParser.parse(code, "Python");

        assertTrue(nodes.stream().anyMatch(n -> n.type().equals("class") && n.name().equals("Animal")));
        assertTrue(nodes.stream().anyMatch(n -> n.type().equals("function") && n.name().equals("speak")));
        assertEquals(1, nodes.stream().filter(n -> n.type().equals("class")).findFirst().get().startLine());
    }

    @Test
    void parse_javaClass() {
        String code = "public class UserService {\n    public void save() {}\n    private String name;\n}\n";
        List<AstNode> nodes = SimpleAstParser.parse(code, "Java");

        assertTrue(nodes.stream().anyMatch(n -> n.type().equals("class") && n.name().equals("UserService")));
        assertTrue(nodes.stream().anyMatch(n -> n.type().equals("method") && n.name().equals("save")));
    }

    @Test
    void parse_jsFunctions() {
        String code = "function add(a, b) { return a + b; }\nconst mul = (a, b) => a * b;\nclass App extends React.Component {}\n";
        List<AstNode> nodes = SimpleAstParser.parse(code, "TypeScript");

        assertTrue(nodes.stream().anyMatch(n -> n.type().equals("function") && n.name().equals("add")));
        assertTrue(nodes.stream().anyMatch(n -> n.type().equals("variable") && n.name().equals("mul")));
        assertTrue(nodes.stream().anyMatch(n -> n.type().equals("class") && n.name().equals("App")));
    }

    @Test
    void parse_emptyCode_returnsEmpty() {
        List<AstNode> nodes = SimpleAstParser.parse("", "Python");
        assertTrue(nodes.isEmpty());
    }

    @Test
    void parse_goFunctions() {
        String code = "func main() {\n\tfmt.Println(\"hello\")\n}\n\ntype Server struct {\n\tPort int\n}\n";
        List<AstNode> nodes = SimpleAstParser.parse(code, "Go");

        assertTrue(nodes.stream().anyMatch(n -> n.type().equals("function") && n.name().equals("main")));
        assertTrue(nodes.stream().anyMatch(n -> n.type().equals("struct") && n.name().equals("Server")));
    }
}
