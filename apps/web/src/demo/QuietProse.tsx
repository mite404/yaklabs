import type { Inline, Block } from "./quiet-prose";

// Every non-link kind wraps its text in one semantic tag; link is the only kind that also
// carries an href, so it is handled on its own rather than folded into this map.
const INLINE_TAGS: Record<Exclude<Inline["kind"], "link" | "text">, "strong" | "em" | "code"> = {
  strong: "strong",
  em: "em",
  code: "code",
};

// The same tags whether the text is still streaming in or finished (ADR-140), never
// `dangerouslySetInnerHTML` - every value here is plain text content.
function InlineView({ segment }: { segment: Inline }) {
  if (segment.kind === "link") return <a href={segment.href}>{segment.text}</a>;
  if (segment.kind === "text") return segment.text;
  const Tag = INLINE_TAGS[segment.kind];
  return <Tag>{segment.text}</Tag>;
}

function BlockView({ block }: { block: Block }) {
  if (block.kind === "heading")
    return (
      <h3>
        {block.content.map((segment, i) => (
          <InlineView key={i} segment={segment} />
        ))}
      </h3>
    );
  if (block.kind === "list")
    return (
      <ul>
        {block.items.map((item, i) => (
          <li key={i}>
            {item.map((segment, j) => (
              <InlineView key={j} segment={segment} />
            ))}
          </li>
        ))}
      </ul>
    );
  return (
    <p>
      {block.content.map((segment, i) => (
        <InlineView key={i} segment={segment} />
      ))}
    </p>
  );
}

/**
 * ADR-140's Quiet prose surface: a small, app-owned response renderer, independent of any
 * Markdown library. `blocks` is already the revealed slice (see `revealBlocks`), so this
 * component only ever renders - streaming and completed content take the identical path, with
 * no extra fade or movement layered on top.
 */
export function QuietProse({ blocks }: { blocks: Block[] }) {
  return (
    <div className="quiet-prose">
      {blocks.map((block, i) => (
        <BlockView key={i} block={block} />
      ))}
    </div>
  );
}
