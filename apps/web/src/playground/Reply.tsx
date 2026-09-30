import { AgentTree, AwaitingInputCard, CatalogCard, UserTurn } from "@yaklabs/catalog";
import type { UserInput } from "@yaklabs/catalog/playground";
import { Button } from "@yaklabs/ui/components/button";
import { useMemo, type ReactNode } from "react";
import { QuietProse } from "../demo/QuietProse";
import type { Body, Failure, Item } from "./body";
import { parseQuietProse } from "./markdown";
import { assertNever } from "./never";
import { canRetry, statusLine, type AgentTurn, type Asked, type Cause, type Reply } from "./state";
import { WorkDetails, lineItems } from "./WorkDetails";

// What a reply can ask the page to do: send a new input (a recovery, an answer, a skip), or
// resend the failed exchange, which only the last one may.
export type ReplyActions = {
  onSend: (user: UserInput) => void;
  onRetry: (() => void) | undefined;
  locked: boolean;
  // Set only when the gateway ended the reply at a limit or an upstream failure: its last
  // failure section then offers Try again beside the limitation.
  retryEnded?: (() => void) | undefined;
};

// Each item kind's own view, looked up by kind so a new kind fails the build until it has one.
type ItemOf = { [I in Item as I["kind"]]: I };
type ItemProps<K extends keyof ItemOf> = { item: ItemOf[K]; body: Body; actions: ReplyActions };
type ItemViews = { [K in keyof ItemOf]: (props: ItemProps<K>) => ReactNode };

function TextItem({ item, body }: ItemProps<"text">) {
  const source = body.text[item.blockId] ?? "";
  const blocks = useMemo(() => parseQuietProse(source), [source]); // → Block[]
  if (blocks.length === 0) return null;
  return <QuietProse blocks={blocks} />;
}

function CardItem({ item, body }: ItemProps<"card">) {
  const card = body.cards[item.cardId];
  if (card === undefined) return null;
  return (
    <div className="pg-card">
      <CatalogCard payload={card.selection} context="thread" shareable={false} />
      {card.note !== undefined && <p className="pg-note">{card.note}</p>}
    </div>
  );
}

function OutcomeItem({ item, body }: ItemProps<"outcome">) {
  const outcome = body.works[item.workId]?.outcome;
  if (outcome === undefined) return null;
  return (
    <div className="quiet-prose pg-outcome">
      <p>
        <strong>{outcome.result}</strong>
      </p>
      {outcome.evidence.length > 0 && <ul>{lineItems(outcome.evidence)}</ul>}
    </div>
  );
}

function Limitation({
  failure,
  actions,
  onRetry,
}: {
  failure: Failure;
  actions: ReplyActions;
  onRetry: (() => void) | undefined;
}) {
  const { recovery } = failure;
  return (
    <section className="pg-failure" aria-label="Limitation">
      <div className="quiet-prose" role="alert">
        <p>{failure.limitation}</p>
      </div>
      {recovery !== null && (
        <>
          <blockquote className="pg-recovery">
            <p>{recovery.prompt}</p>
          </blockquote>
          <Button
            variant="outline"
            disabled={actions.locked}
            onClick={() => {
              actions.onSend({ kind: "say", text: recovery.prompt });
            }}
          >
            {recovery.label}
          </Button>
        </>
      )}
      <TryAgain onRetry={onRetry} />
    </section>
  );
}

function FailureItem({ item, body, actions }: ItemProps<"failure">) {
  const failure = body.failures.at(item.index);
  if (failure === undefined) return null;
  const last = item.index === body.failures.length - 1;
  return (
    <Limitation
      failure={failure}
      actions={actions}
      onRetry={last ? actions.retryEnded : undefined}
    />
  );
}

// Each entry renders its view as an element, so hooks stay inside the components; calling the
// entry (not rendering it as JSX) lets TypeScript pair the kind with its props.
const ITEM_VIEWS: ItemViews = {
  text: (props) => <TextItem {...props} />,
  card: (props) => <CardItem {...props} />,
  outcome: (props) => <OutcomeItem {...props} />,
  failure: (props) => <FailureItem {...props} />,
};

// `kind` travels beside the props so the lookup and the view's input stay paired.
function ItemView<K extends keyof ItemOf>({ kind, ...props }: ItemProps<K> & { kind: K }) {
  const render = ITEM_VIEWS[kind]; // → (props: ItemProps<K>) => ReactNode
  return render(props);
}

function itemKey(item: Item, body: Body): string {
  switch (item.kind) {
    case "text":
      return `text:${item.blockId}`;
    case "card":
      return `card:${item.cardId}:${String(body.cards[item.cardId]?.revision ?? 0)}`;
    case "outcome":
      return `outcome:${item.workId}`;
    case "failure":
      return `failure:${String(item.index)}`;
    default:
      return assertNever(item);
  }
}

function Status({ text }: { text: string | undefined }) {
  if (text === undefined) return null;
  return (
    <output className="pg-status">
      <AgentTree label="Working" />
      <span>{text}</span>
    </output>
  );
}

// An answered question stays in the thread: its words, then the user's reply or the skip.
function QuestionRecord({ asked, reply }: { asked: Asked; reply: Reply }) {
  return (
    <>
      <p className="turn turn-agent pg-note">{asked.question.question}</p>
      {reply.kind === "answer" ? (
        <UserTurn
          message={{ id: asked.questionId, role: "user", text: reply.text, time: reply.at }}
        />
      ) : (
        <p className="turn turn-agent pg-note">Skipped.</p>
      )}
    </>
  );
}

// Resends the reply's own input; only the last reply has somewhere to send it.
function TryAgain({ onRetry }: { onRetry: (() => void) | undefined }) {
  if (onRetry === undefined) return null;
  return (
    <Button variant="outline" onClick={onRetry}>
      Try again
    </Button>
  );
}

function CauseSection({ cause, actions }: { cause: Cause; actions: ReplyActions }) {
  return (
    <section className="pg-failure" aria-label={cause.title}>
      <div className="quiet-prose" role="alert">
        <p>
          <strong>{cause.title}</strong>
        </p>
        {cause.detail !== "" && <p>{cause.detail}</p>}
      </div>
      {cause.retry && <TryAgain onRetry={actions.onRetry} />}
    </section>
  );
}

function BodyView({
  body,
  status,
  actions,
}: {
  body: Body;
  status: string | undefined;
  actions: ReplyActions;
}) {
  return (
    <>
      {body.items.map((item) => (
        <ItemView
          key={itemKey(item, body)}
          kind={item.kind}
          item={item}
          body={body}
          actions={actions}
        />
      ))}
      <Status text={status} />
      <WorkDetails body={body} />
    </>
  );
}

// Before the first event: the same status line the live reply shows, so nothing jumps when
// the reply starts streaming.
function Waiting() {
  return (
    <div className="turn turn-agent">
      <Status text="Thinking…" />
    </div>
  );
}

/**
 * One reply as the page shows it, by phase: a thinking line while it waits, its items in
 * arrival order with the status line and Work details, then its question (live or answered),
 * the reason it failed, or Try again when the gateway ended it at a limit or a failure.
 */
export function AgentReply({ turn, actions }: { turn: AgentTurn; actions: ReplyActions }) {
  if (turn.phase === "waiting") return <Waiting />;
  const body = turn.body;
  const status = statusLine(turn);
  // A live reply always shows its status line, even before it has anything else to show.
  const shown =
    body !== null && (body.items.length > 0 || body.workOrder.length > 0 || status !== undefined);
  const retryEnded = turn.phase === "done" && canRetry(turn) ? actions.onRetry : undefined;
  return (
    <>
      {shown && (
        <article className="turn turn-agent" aria-busy={turn.phase === "streaming" || undefined}>
          <BodyView body={body} status={status} actions={{ ...actions, retryEnded }} />
        </article>
      )}
      {turn.phase === "asked" && (
        <div className="turn turn-agent">
          <AwaitingInputCard
            question={turn.asked.question}
            onAnswer={(text) => {
              actions.onSend({ kind: "answer", questionId: turn.asked.questionId, text });
            }}
            onElsewhere={() => {
              actions.onSend({ kind: "skip", questionId: turn.asked.questionId });
            }}
          />
        </div>
      )}
      {turn.phase === "resolved" && <QuestionRecord asked={turn.asked} reply={turn.reply} />}
      {turn.phase === "failed" && (
        <div className="turn turn-agent">
          <CauseSection cause={turn.cause} actions={actions} />
        </div>
      )}
    </>
  );
}
