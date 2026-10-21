import { describe, expect, test } from 'vitest';
import { explainError } from '../../src/python/errors';

const err = (type: string, message: string) => ({ type, message, line: 1, traceback: '' });

describe('deutsche Fehlererklärungen', () => {
  test.each([
    ['NameError', "name 'wert' is not defined", 'wert'],
    ['SyntaxError', "expected ':'", 'Doppelpunkt'],
    ['IndentationError', 'expected an indented block after', 'Einrückung'],
    ['TypeError', 'can only concatenate str (not "int") to str', 'Text und Zahl'],
    ['IndexError', 'list index out of range', 'Index'],
    ['ZeroDivisionError', 'division by zero', 'null'],
    [
      'ValueError',
      'operands could not be broadcast together with shapes (2,) (3,)',
      'Array-Formen',
    ],
  ])('%s', (type, message, expected) => {
    expect(explainError(err(type, message)).title).toContain(expected);
  });

  test('unbekannte Fehler bekommen eine allgemeine Erklärung', () => {
    expect(explainError(err('OSError', 'x')).title).toBe('OSError');
  });
});
