import Parser from './Parser';

describe('Parser', () => {
    describe('parsing', () => {
        it('parses a thing', () => {
            const scanner = new Parser(`
#token NUMBER (?<value>-?(\\d|[1-9]\\d+)(\\.\\d+)?([eE](+|-)?\\d+)?)
#token LEFT_PAREN \\[
#token RIGHT_PAREN \\]
#token COMMA ,

#expr Program = (?<json>Array)

#expr Array = LEFT_PAREN ( (?<values>Value) ( COMMA (?<values>Value) )* )? RIGHT_PAREN

#expr Value = (?<value>Array|NUMBER)


[1, 2, 
        `);
            // scanner.scan();
            // scanner.tokens.forEach(token => console.log(token.toString()));
            // scanner.scanErrors.forEach(error => console.error(error.toString()));
            // scanner.expressions.forEach(expression => console.log(JSON.stringify(expression, null, 2)));
            const parseResult = scanner.parse();
            console.log(JSON.stringify(
                parseResult,
                null,
                2
            ));
        });

        it('reports expectations at incomplete syntax', () => {
            const scanner = new Parser(`
#token LEFT_BRACE \\{
#token RIGHT_BRACE \\}
#token EQUALS \\=
#token SEMICOLON ;
#token LEFT_PAREN \\(
#token RIGHT_PAREN \\)

#token IDENTIFIER (?<identifier>[a-zA-Z0-9]+)
#token NUMERIC_LITERAL (?<value>-?[1-9][0-9]*(\\.[0-9]+)?)
#token BOOLEAN_LITERAL (?<value>true|false)
#token STRING_LITERAL "((?<value>[^"\\\\])|\\\\(?<value>.))*"

#expr Program = (?<expressions>Expression)

#expr Expression = (?<@expression> AssignmentExpression | LiteralExpression | IDENTIFIER)
#expr LiteralExpression = (?<@expression> BOOLEAN_LITERAL | NUMERIC_LITERAL | STRING_LITERAL)
#expr AssignmentExpression = (?<identifier>IDENTIFIER) EQUALS (?<expression>Expression)

#expr ParentheticalExpression = LEFT_PAREN (?<@expression>Expression) RIGHT_PAREN
#expr Expression = (?<@expression>ParentheticalExpression)

// Mathematical operations
#token ADD +
#token SUBTRACT -
#token MULTIPLY *
#token DIVIDE /

#expr HighAlgebraicExpression = (?<left>Expression) ((?<addition>ADD)|(?<subtraction>SUBTRACT)) (?<right>Expression)?
#expr HighAlgebraicExpression = (?<@expression>LowAlgebraicExpression)
#expr LowAlgebraicExpression = (?<left>Expression) ((?<multiplication>MULTIPLY)|(?<division>DIVIDE)) (?<right>Expression)?
#expr Expression = (?<@expression>HighAlgebraicExpression)

2 * 3 + 4
        `);
            // scanner.scan();
            // scanner.tokens.forEach(token => console.log(token.toString()));
            // scanner.scanErrors.forEach(error => console.error(error.toString()));
            // scanner.expressions.forEach(expression => console.log(JSON.stringify(expression, null, 2)));
            const parseResult = scanner.parse();
            console.log(
                JSON.stringify(
                    parseResult,
                    null,
                    2
                )
            );
        });
    });
});
