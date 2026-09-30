import { AgentTree, AwaitingInputCard, CatalogCard, UserTurn } from "@yaklabs/catalog";
import type { UserInput } from "@yaklabs/catalog/playground";
import { Button } from "@yaklabs/ui/components/button";
import { useMemo } from "react";
import { QuietProse } from "../demo/QuietProse";
import type { Body, Failure, Item } from "./body";
import { parseQuietProse } from "./markdown";
import { assertNever } from "./never";
import { statusLine, type AgentTurn, type Asked, type Cause, type Reply } from "./state";
import { WorkDetails } from "./WorkDetails";

// What a reply can ask the page to do: send a new input (a recovery, an answer, a skip), or
// resend the failed exchange, which only the last one may.
export type ReplyActions = {
  onSend: (user: UserInput) => void;
  onRetry: (() => void) | undefined;
  locked: boolean;
};

function TextItem({ source }: { source: string }) {
  const blocks = useMemo(() => parseQuietProse(source), [source]); // → Block[]
  if (blocks.length === 0) return null;
  return <QuietProse blocks={blocks} />;
}

function FailureItem({ failure, actions }: { failure: Failure; actions: ReplyActions }) {
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
    </section>
  );
}

function ItemView({ item, body, actions }: { item: Item; body: Body; actions: ReplyActions }) {
  switch (item.kind) {
    case "text":
      return <TextItem source={body.text[item.blockId] ?? ""} />;
    case "card": {
      const card = body.cards[item.cardId];
      if (card === undefined) return null;
      return (
        <div className="pg-card">
          <CatalogCard payload={card.selection} context="thread" shareable={false} />
          {card.note !== undefined && <p className="pg-note">{card.note}</p>}
        </div>
      );
    }
    case "outcome": {
      const outcome = body.works[item.workId]?.outcome;
      if (outcome === undefined) return null;
      return (
        <div className="quiet-prose pg-outcome">
          <p>
            <strong>{outcome.result}</strong>
          </p>
          {outcome.evidence.length > 0 && (
            <ul>
              {outcome.evidence.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          )}
        </div>
      );
    }
    case "failure": {
      const failure = body.failures.at(item.index);
      return failure === undefined ? null : <FailureItem failure={failure} actions={actions} />;
    }
    default:
      return assertNever(item);
  }
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

function CauseSection({ cause, actions }: { cause: Cause; actions: ReplyActions }) {
  return (
    <section className="pg-failure" aria-label={cause.title}>
      <div className="quiet-prose" role="alert">
        <p>
          <strong>{cause.title}</strong>
        </p>
        {cause.detail !== "" && <p>{cause.detail}</p>}
      </div>
      {cause.retry && actions.onRetry !== undefined && (
        <Button variant="outline" onClick={actions.onRetry}>
          Try again
        </Button>
      )}
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
        <ItemView key={itemKey(item, body)} item={item} body={body} actions={actions} />
      ))}
      <Status text={status} />
      <WorkDetails body={body} />
    </>
  );
}

function Waiting() {
  return (
    <div className="turn turn-agent turn-pending">
      <AgentTree label="Thinking" />
      <span aria-hidden="true">Thinking…</span>
    </div>
  );
}

/**
 * One reply as the page shows it, by phase: a thinking line while it waits, its items in
 * arrival order with the status line and Work details, then its question (live or answered)
 * or the reason it failed.
 */
export function AgentReply({ turn, actions }: { turn: AgentTurn; actions: ReplyActions }) {
  if (turn.phase === "waiting") return <Waiting />;
  const body = turn.body;
  const status = statusLine(turn);
  const shown = body !== null && (body.items.length > 0 || body.workOrder.length > 0);
  return (
    <>
      {shown && (
        <article className="turn turn-agent" aria-busy={turn.phase === "streaming" || undefined}>
          <BodyView body={body} status={status} actions={actions} />
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
