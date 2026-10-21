import type { PyError } from './protocol';

export interface ErrorExplanation {
  title: string;
  explanation: string;
  tip: string;
}

interface Rule {
  type: string;
  pattern?: RegExp;
  explain: (match: RegExpMatchArray | null, error: PyError) => ErrorExplanation;
}

const RULES: Rule[] = [
  {
    type: 'NameError',
    pattern: /name '(.+?)' is not defined/,
    explain: (m) => ({
      title: `Python kennt den Namen „${m?.[1] ?? '?'}“ nicht`,
      explanation:
        'Ein Name wird benutzt, bevor er existiert: Die Variable oder Funktion wurde nie (oder erst später) definiert.',
      tip: 'Prüfe Tippfehler und Groß-/Kleinschreibung. Steht die Zuweisung vor dieser Zeile? Text braucht Anführungszeichen: "Hallo" statt Hallo.',
    }),
  },
  {
    type: 'IndentationError',
    pattern: /expected an indented block/,
    explain: () => ({
      title: 'Hier fehlt eine Einrückung',
      explanation:
        'Nach einer Zeile mit Doppelpunkt (if, for, while, def, …) muss der zugehörige Block eingerückt sein.',
      tip: 'Rücke die Zeilen des Blocks um 4 Leerzeichen ein (Taste ⇥ in der Symbolleiste).',
    }),
  },
  {
    type: 'IndentationError',
    pattern: /unexpected indent/,
    explain: () => ({
      title: 'Unerwartete Einrückung',
      explanation: 'Diese Zeile ist eingerückt, obwohl sie zu keinem Block gehört.',
      tip: 'Entferne die Leerzeichen am Zeilenanfang oder prüfe, ob darüber ein Doppelpunkt fehlt.',
    }),
  },
  {
    type: 'IndentationError',
    explain: () => ({
      title: 'Einrückung passt nicht',
      explanation: 'Die Einrückung dieser Zeile passt zu keinem der Blöcke darüber.',
      tip: 'Zeilen im selben Block brauchen exakt dieselbe Anzahl Leerzeichen. Mische keine Tabs und Leerzeichen.',
    }),
  },
  {
    type: 'TabError',
    explain: () => ({
      title: 'Tabs und Leerzeichen gemischt',
      explanation: 'Python sieht einen Tab und Leerzeichen als unterschiedliche Einrückung.',
      tip: 'Verwende nur Leerzeichen (die ⇥-Taste der App fügt 4 Leerzeichen ein).',
    }),
  },
  {
    type: 'SyntaxError',
    pattern: /expected ':'/,
    explain: () => ({
      title: 'Doppelpunkt fehlt',
      explanation:
        'Zeilen mit if, elif, else, for, while, def und class enden mit einem Doppelpunkt.',
      tip: 'Setze am Ende der markierten Zeile ein „:“.',
    }),
  },
  {
    type: 'SyntaxError',
    pattern: /unterminated string literal|EOL while scanning/,
    explain: () => ({
      title: 'Text nicht abgeschlossen',
      explanation:
        'Ein Text (String) wurde mit einem Anführungszeichen begonnen, aber nicht beendet.',
      tip: 'Jedes " oder \' braucht ein passendes Gegenstück in derselben Zeile.',
    }),
  },
  {
    type: 'SyntaxError',
    pattern: /'\(' was never closed|'\[' was never closed|'\{' was never closed|unexpected EOF/,
    explain: () => ({
      title: 'Klammer nicht geschlossen',
      explanation: 'Eine öffnende Klammer hat kein schließendes Gegenstück.',
      tip: 'Zähle die Klammern in der markierten Zeile: Zu jedem ( gehört ein ).',
    }),
  },
  {
    type: 'SyntaxError',
    pattern: /invalid syntax\. Maybe you meant '==' or ':=' instead of '='|cannot assign to/,
    explain: () => ({
      title: 'Zuweisung statt Vergleich?',
      explanation: '„=“ weist einen Wert zu, „==“ vergleicht zwei Werte.',
      tip: 'In Bedingungen (if, while) brauchst du meistens „==“.',
    }),
  },
  {
    type: 'SyntaxError',
    explain: () => ({
      title: 'Python versteht diese Zeile nicht',
      explanation:
        'Die Zeile verletzt die Grammatik von Python. Oft liegt der eigentliche Fehler kurz vor der markierten Stelle.',
      tip: 'Prüfe Klammern, Anführungszeichen, Doppelpunkte und Kommas – auch in der Zeile darüber.',
    }),
  },
  {
    type: 'TypeError',
    pattern:
      /can only concatenate str \(not "(.+?)"\) to str|unsupported operand type\(s\) for \+: '(int|float)' and 'str'/,
    explain: () => ({
      title: 'Text und Zahl lassen sich nicht addieren',
      explanation:
        '„+“ verbindet entweder zwei Texte oder addiert zwei Zahlen – nicht beides gemischt.',
      tip: 'Wandle um: str(zahl) für Text, int(text) oder float(text) für Zahlen – oder nutze einen f-String: f"Wert: {zahl}".',
    }),
  },
  {
    type: 'TypeError',
    pattern: /missing (\d+) required positional argument/,
    explain: () => ({
      title: 'Funktion bekommt zu wenige Argumente',
      explanation: 'Die Funktion erwartet mehr Werte in den Klammern, als du übergeben hast.',
      tip: 'Vergleiche den Aufruf mit der Definition (def …): Für jeden Parameter brauchst du einen Wert.',
    }),
  },
  {
    type: 'TypeError',
    pattern: /takes (\d+) positional arguments? but (\d+) (were|was) given/,
    explain: () => ({
      title: 'Funktion bekommt zu viele Argumente',
      explanation:
        'Du übergibst mehr Werte, als die Funktion Parameter hat. Bei Methoden zählt self mit.',
      tip: 'Vergleiche Aufruf und Definition. Fehlt in der Methode vielleicht der Parameter self?',
    }),
  },
  {
    type: 'TypeError',
    pattern: /'(.+?)' object is not callable/,
    explain: (m) => ({
      title: `Ein ${m?.[1] ?? 'Wert'} ist keine Funktion`,
      explanation:
        'Hinter dem Namen stehen runde Klammern, aber der Name zeigt auf einen Wert, nicht auf eine Funktion.',
      tip: 'Hast du eine Variable so genannt wie eine Funktion (z. B. list = …, sum = …)? Oder meinst du eckige Klammern für einen Index?',
    }),
  },
  {
    type: 'TypeError',
    pattern: /'(.+?)' object is not subscriptable/,
    explain: (m) => ({
      title: `${m?.[1] ?? 'Dieser Wert'} hat keinen Index`,
      explanation: 'Eckige Klammern [ ] funktionieren nur bei Listen, Texten, Dicts usw.',
      tip: 'Prüfe, welchen Typ die Variable wirklich hat – z. B. mit print(type(x)).',
    }),
  },
  {
    type: 'TypeError',
    explain: () => ({
      title: 'Falscher Datentyp',
      explanation: 'Eine Operation bekommt einen Wert vom falschen Typ.',
      tip: 'Lass dir die beteiligten Werte und Typen ausgeben: print(x, type(x)).',
    }),
  },
  {
    type: 'ValueError',
    pattern: /invalid literal for int\(\) with base 10/,
    explain: () => ({
      title: 'Text ist keine ganze Zahl',
      explanation: 'int() kann nur Texte wie "42" umwandeln, nicht "4.2" oder "vier".',
      tip: 'Für Kommazahlen float() verwenden. Leerzeichen und Buchstaben vorher entfernen.',
    }),
  },
  {
    type: 'ValueError',
    pattern: /could not convert string to float/,
    explain: () => ({
      title: 'Text ist keine Zahl',
      explanation: 'float() erwartet einen Punkt als Dezimaltrennzeichen: "3.5", nicht "3,5".',
      tip: 'Ersetze das Komma: text.replace(",", ".").',
    }),
  },
  {
    type: 'ValueError',
    pattern: /operands could not be broadcast together|shapes .* not aligned|matmul: Input operand/,
    explain: () => ({
      title: 'Array-Formen passen nicht zusammen',
      explanation:
        'NumPy kann die beiden Arrays nicht elementweise oder als Matrixprodukt verknüpfen.',
      tip: 'Gib die Formen aus: print(a.shape, b.shape). Beim Matrixprodukt A @ B muss A.shape[1] == B.shape[0] sein.',
    }),
  },
  {
    type: 'ValueError',
    explain: () => ({
      title: 'Unpassender Wert',
      explanation: 'Der Typ stimmt, aber der konkrete Wert ist für diese Operation ungültig.',
      tip: 'Lies die Originalmeldung unten genau – sie nennt meist den problematischen Wert.',
    }),
  },
  {
    type: 'IndexError',
    explain: () => ({
      title: 'Index außerhalb der Liste',
      explanation:
        'Du greifst auf eine Position zu, die es nicht gibt. Eine Liste mit n Elementen hat die Indizes 0 bis n-1.',
      tip: 'Prüfe mit len(liste), wie lang die Liste ist. Häufig: Schleife läuft eins zu weit (range(len(x) + 1)).',
    }),
  },
  {
    type: 'KeyError',
    explain: (_m, e) => ({
      title: `Schlüssel ${e.message} fehlt im Dict`,
      explanation: 'Das Dictionary enthält diesen Schlüssel nicht.',
      tip: 'Prüfe Schreibweise und Typ des Schlüssels ("1" ist nicht 1). Sicher abfragen: d.get(schluessel, standardwert).',
    }),
  },
  {
    type: 'ZeroDivisionError',
    explain: () => ({
      title: 'Division durch null',
      explanation: 'Durch 0 zu teilen ist mathematisch nicht definiert.',
      tip: 'Prüfe vorher, ob der Nenner 0 sein kann: if n != 0: …',
    }),
  },
  {
    type: 'AttributeError',
    pattern: /'(.+?)' object has no attribute '(.+?)'/,
    explain: (m) => ({
      title: `${m?.[1] ?? 'Objekt'} hat kein „${m?.[2] ?? '?'}“`,
      explanation: 'Nach dem Punkt steht ein Name, den dieser Objekttyp nicht kennt.',
      tip: 'Tippfehler? Hat die Variable den Typ, den du erwartest? Bei eigenen Klassen: wurde self.… im __init__ gesetzt?',
    }),
  },
  {
    type: 'ModuleNotFoundError',
    explain: () => ({
      title: 'Modul nicht gefunden',
      explanation:
        'Im Browser stehen die Standardbibliothek, NumPy und das App-Modul lab zur Verfügung – nicht jedes Paket.',
      tip: 'Prüfe die Schreibweise (numpy, nicht Numpy). Pakete wie torch gibt es hier nicht.',
    }),
  },
  {
    type: 'RecursionError',
    explain: () => ({
      title: 'Endlose Rekursion',
      explanation: 'Eine Funktion ruft sich immer wieder selbst auf, ohne je aufzuhören.',
      tip: 'Jede rekursive Funktion braucht einen Abbruchfall, der ohne erneuten Aufruf zurückkehrt.',
    }),
  },
  {
    type: 'UnboundLocalError',
    explain: () => ({
      title: 'Lokale Variable vor Zuweisung benutzt',
      explanation:
        'In einer Funktion wird eine Variable gelesen, die erst weiter unten in derselben Funktion zugewiesen wird.',
      tip: 'Übergib den Wert als Parameter und gib das Ergebnis mit return zurück, statt globale Variablen zu verändern.',
    }),
  },
  {
    type: 'AssertionError',
    explain: () => ({
      title: 'Eine Prüfung (assert) ist fehlgeschlagen',
      explanation: 'assert bedingung bricht ab, wenn die Bedingung False ist.',
      tip: 'Gib die Werte aus, die in der Bedingung vorkommen, und vergleiche sie mit deiner Erwartung.',
    }),
  },
];

export function explainError(error: PyError): ErrorExplanation {
  for (const rule of RULES) {
    if (rule.type !== error.type) continue;
    const match = rule.pattern ? error.message.match(rule.pattern) : null;
    if (rule.pattern && !match) continue;
    return rule.explain(match, error);
  }
  return {
    title: `${error.type}`,
    explanation: 'Beim Ausführen ist ein Fehler aufgetreten.',
    tip: 'Lies die letzte Zeile der Originalmeldung und schau dir die markierte Codezeile an.',
  };
}
