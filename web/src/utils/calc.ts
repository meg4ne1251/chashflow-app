type Token = { type: 'number'; value: number } | { type: 'op'; value: string };

function tokenize(expr: string): Token[] | null {
  const tokens: Token[] = [];
  let i = 0;
  while (i < expr.length) {
    if (expr[i] >= '0' && expr[i] <= '9') {
      let num = '';
      while (i < expr.length && expr[i] >= '0' && expr[i] <= '9') {
        num += expr[i++];
      }
      tokens.push({ type: 'number', value: parseInt(num, 10) });
    } else if ('+-*/'.includes(expr[i])) {
      tokens.push({ type: 'op', value: expr[i] });
      i++;
    } else {
      return null;
    }
  }
  return tokens.length > 0 ? tokens : null;
}

function parseFactor(tokens: Token[], pos: number): { value: number; pos: number } | null {
  if (pos >= tokens.length) return null;
  const token = tokens[pos];
  if (token.type === 'number') {
    return { value: token.value, pos: pos + 1 };
  }
  return null;
}

function parseTerm(tokens: Token[], pos: number): { value: number; pos: number } | null {
  let result = parseFactor(tokens, pos);
  if (!result) return null;

  while (result.pos < tokens.length) {
    const token = tokens[result.pos];
    if (token.type !== 'op' || (token.value !== '*' && token.value !== '/')) break;

    const right = parseFactor(tokens, result.pos + 1);
    if (!right) return null;

    if (token.value === '*') {
      result = { value: result.value * right.value, pos: right.pos };
    } else {
      if (right.value === 0) return null;
      result = { value: Math.round(result.value / right.value), pos: right.pos };
    }
  }

  return result;
}

function parseExpr(tokens: Token[], pos: number): { value: number; pos: number } | null {
  let result = parseTerm(tokens, pos);
  if (!result) return null;

  while (result.pos < tokens.length) {
    const token = tokens[result.pos];
    if (token.type !== 'op' || (token.value !== '+' && token.value !== '-')) break;

    const right = parseTerm(tokens, result.pos + 1);
    if (!right) return null;

    if (token.value === '+') {
      result = { value: result.value + right.value, pos: right.pos };
    } else {
      result = { value: result.value - right.value, pos: right.pos };
    }
  }

  return result;
}

/**
 * Evaluate a simple arithmetic expression.
 * Supports +, -, *, / with standard operator precedence.
 * Division rounds to nearest integer (Math.round).
 * Returns null for invalid expressions or division by zero.
 */
export function evaluateExpression(expr: string): number | null {
  const cleaned = expr.replace(/\s/g, '');
  if (!cleaned) return null;

  const tokens = tokenize(cleaned);
  if (!tokens) return null;

  const result = parseExpr(tokens, 0);
  if (result && result.pos === tokens.length) {
    return result.value;
  }
  return null;
}

/**
 * Check if the expression string contains arithmetic operators.
 */
export function hasOperator(expr: string): boolean {
  return /[+\-*/]/.test(expr);
}
