import type { Inline, Block } from "./quiet-prose";

// One inline segment: the same four tags whether the text is still streaming in or finished
// (ADR-140), never `dangerouslySetInnerHTML` - every value here is plain text content.
function InlineView({ segment }: { segment: Inline }) {
  switch (segment.kind) {
    case "text":
      return segment.text;
    case "strong":
      return <strong>{segment.text}</strong>;
    case "em":
      return <em>{segment.text}</em>;
    case "link":
      return <a href={segment.href}>{segment.text}</a>;
    case "code":
      return <code>{segment.text}</code>;
  }
  return segment satisfies never;
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
