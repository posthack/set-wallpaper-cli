export type Key =
  | { type: "up" }
  | { type: "down" }
  | { type: "pageUp" }
  | { type: "pageDown" }
  | { type: "home" }
  | { type: "end" }
  | { type: "enter" }
  | { type: "escape" }
  | { type: "backspace" }
  | { type: "clear" }
  | { type: "text"; value: string }
  | { type: "ignore" };

const ESC = "\x1b";

const isFinalByte = (char: string) => char >= "\x40" && char <= "\x7e";

// A chunk can hold a burst of keypresses or a reply to one of our queries, so
// it has to be split rather than compared whole.
function tokenize(input: string): string[] {
  const tokens: string[] = [];
  let index = 0;

  while (index < input.length) {
    const char = input[index]!;
    if (char !== ESC) {
      tokens.push(char);
      index++;
      continue;
    }

    const next = input[index + 1];
    if (next === "[" || next === "O") {
      let end = index + 2;
      while (end < input.length && !isFinalByte(input[end]!)) end++;
      if (end < input.length) {
        tokens.push(input.slice(index, end + 1));
        index = end + 1;
        continue;
      }
      tokens.push(input.slice(index)); // cut off at a chunk boundary
      break;
    }

    tokens.push(ESC);
    index++;
  }

  return tokens;
}

export function classify(token: string): Key {
  switch (token) {
    case "\r":
    case "\n":
      return { type: "enter" };
    case ESC:
    case "\x03":
    case "\x04":
      return { type: "escape" };
    case "\x7f":
    case "\b":
      return { type: "backspace" };
    case "\x15":
      return { type: "clear" };
    case `${ESC}[A`:
    case `${ESC}OA`:
      return { type: "up" };
    case `${ESC}[B`:
    case `${ESC}OB`:
      return { type: "down" };
    case `${ESC}[5~`:
      return { type: "pageUp" };
    case `${ESC}[6~`:
      return { type: "pageDown" };
    case `${ESC}[H`:
    case `${ESC}[1~`:
    case `${ESC}OH`:
      return { type: "home" };
    case `${ESC}[F`:
    case `${ESC}[4~`:
    case `${ESC}OF`:
      return { type: "end" };
  }

  // Terminal replies land here. Dropping them beats eating a real keypress.
  if (token.startsWith(ESC)) return { type: "ignore" };

  return token >= " " ? { type: "text", value: token } : { type: "ignore" };
}

export function parseKeys(input: string): Key[] {
  return tokenize(input).map(classify);
}
