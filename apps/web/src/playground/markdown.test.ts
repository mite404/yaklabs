import { describe, expect, it } from "vitest";
import { code, em, heading, link, list, paragraph, strong, text } from "../demo/quiet-prose";
import { parseQuietProse } from "./markdown";

describe("parseQuietProse: blocks", () => {
  it("reads every heading level as one heading", () => {
    expect(parseQuietProse("# One\n## Two\n### Three")).toEqual([
      heading([text("One")]),
      heading([text("Two")]),
      heading([text("Three")]),
    ]);
  });

  it("gathers consecutive list lines of any marker into one list", () => {
    expect(parseQuietProse("- a\n* b\n1. c\n  more of c")).toEqual([
      list([[text("a")], [text("b")], [text("c more of c")]]),
    ]);
  });

  it("splits paragraphs on blank lines and joins wrapped lines with a space", () => {
    expect(parseQuietProse("One line\nwraps here.\n\nNext.")).toEqual([
      paragraph([text("One line wraps here.")]),
      paragraph([text("Next.")]),
    ]);
  });

  it("ends a list at a paragraph line and drops rules and empty input", () => {
    expect(parseQuietProse("- a\nAfter\n\n---\n")).toEqual([
      list([[text("a")]]),
      paragraph([text("After")]),
    ]);
    expect(parseQuietProse("")).toEqual([]);
  });
});

describe("parseQuietProse: inline", () => {
  it("reads strong, em, code and links", () => {
    expect(
      parseQuietProse("**Bold** and *em* and _also_ and `x = 1` and [docs](https://a.test/b)."),
    ).toEqual([
      paragraph([
        strong("Bold"),
        text(" and "),
        em("em"),
        text(" and "),
        em("also"),
        text(" and "),
        code("x = 1"),
        text(" and "),
        link("docs", "https://a.test/b"),
        text("."),
      ]),
    ]);
  });

  it("keeps mailto links and flattens markers nested in a span", () => {
    expect(parseQuietProse("[**mail** us](mailto:a@b.test)")).toEqual([
      paragraph([link("mail us", "mailto:a@b.test")]),
    ]);
  });

  it("leaves arithmetic, snake_case and bare brackets as text", () => {
    expect(parseQuietProse("2 * 3 and 5*3 and snake_case_name and [sic] here")).toEqual([
      paragraph([text("2 * 3 and 5*3 and snake_case_name and [sic] here")]),
    ]);
  });

  it("shows only the text of links with unsafe or missing schemes", () => {
    expect(
      parseQuietProse(
        "[a](javascript:void) [b](JaVaScRiPt:x) [c](http://a.test) [d](/path) [e](data:x)",
      ),
    ).toEqual([paragraph([text("a b c d e")])]);
  });
});

describe("parseQuietProse: unfinished syntax while streaming", () => {
  it("shows an unclosed span as its kind with the marker hidden", () => {
    expect(parseQuietProse("a **bol")).toEqual([paragraph([text("a "), strong("bol")])]);
    expect(parseQuietProse("a *ita")).toEqual([paragraph([text("a "), em("ita")])]);
    expect(parseQuietProse("a _ita")).toEqual([paragraph([text("a "), em("ita")])]);
    expect(parseQuietProse("a `co")).toEqual([paragraph([text("a "), code("co")])]);
  });

  it("hides a lone marker at the very end", () => {
    expect(parseQuietProse("a **")).toEqual([paragraph([text("a ")])]);
    expect(parseQuietProse("a *")).toEqual([paragraph([text("a ")])]);
    expect(parseQuietProse("a _")).toEqual([paragraph([text("a ")])]);
    expect(parseQuietProse("a `")).toEqual([paragraph([text("a ")])]);
  });

  it("shows only a link's text until its url closes", () => {
    expect(parseQuietProse("see [do")).toEqual([paragraph([text("see do")])]);
    expect(parseQuietProse("see [docs](")).toEqual([paragraph([text("see docs")])]);
    expect(parseQuietProse("see [docs](https://a.te")).toEqual([paragraph([text("see docs")])]);
  });

  it("shows nothing for a heading or list marker with no text yet", () => {
    expect(parseQuietProse("Intro\n\n###")).toEqual([paragraph([text("Intro")])]);
    expect(parseQuietProse("### ")).toEqual([]);
    expect(parseQuietProse("- a\n-")).toEqual([list([[text("a")]])]);
  });

  it("never throws on odd input", () => {
    expect(() => parseQuietProse("**_`[](*)`_**\n\n- \n#\n[")).not.toThrow();
  });
});
