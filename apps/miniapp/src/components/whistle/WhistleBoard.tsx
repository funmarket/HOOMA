import {
  WHISTLE_MAX_GRAPHEMES,
  countWhistleGraphemes,
  type WhistleFeedResponse,
  type WhistleMessageView,
} from '@hooma/contracts';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import {
  getCommunityWhistles,
  sendCommunityWhistle,
  whistleQueryKey,
} from '../../features/whistle/api';
import './WhistleBoard.css';

const POLL_INTERVAL_MS = 15_000;

function relativeTime(value: string) {
  const elapsedSeconds = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 1000));
  if (elapsedSeconds < 60) return 'NOW';
  const minutes = Math.floor(elapsedSeconds / 60);
  if (minutes < 60) return `${minutes}M`;
  const hours = Math.floor(minutes / 60);
  return `${hours}H`;
}

function resetLabel(resetAt: string) {
  return new Date(resetAt).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'UTC',
    hour12: false,
  });
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');
}

function WhistleRow({ item }: { item: WhistleMessageView }) {
  return (
    <article className="whistle-row">
      <div className="whistle-avatar" aria-hidden="true">
        {item.author.photoUrl ? (
          <img src={item.author.photoUrl} alt="" loading="lazy" />
        ) : (
          <span>{initials(item.author.displayName) || 'H'}</span>
        )}
      </div>
      <div className="whistle-row-copy">
        <div className="whistle-row-meta">
          <strong>{item.author.displayName}</strong>
          <time dateTime={item.createdAt}>{relativeTime(item.createdAt)}</time>
        </div>
        <p>{item.body}</p>
      </div>
    </article>
  );
}

export function WhistleBoard({ communityId }: { communityId: string }) {
  const queryClient = useQueryClient();
  const [body, setBody] = useState('');
  const queryKey = whistleQueryKey(communityId);
  const query = useQuery({
    queryKey,
    queryFn: () => getCommunityWhistles(communityId),
    refetchInterval: POLL_INTERVAL_MS,
    refetchIntervalInBackground: false,
  });
  const mutation = useMutation({
    mutationFn: (message: string) => sendCommunityWhistle(communityId, message),
    onSuccess: (response) => {
      queryClient.setQueryData<WhistleFeedResponse>(queryKey, (current) => ({
        day: response.day,
        dailyLimit: response.dailyLimit,
        remaining: response.remaining,
        resetAt: response.resetAt,
        items: [
          response.item,
          ...(current?.day === response.day
            ? current.items.filter((item) => item.id !== response.item.id)
            : []),
        ],
      }));
      setBody('');
      void queryClient.invalidateQueries({ queryKey });
    },
  });

  const trimmedBody = body.trim();
  const graphemes = useMemo(() => countWhistleGraphemes(trimmedBody), [trimmedBody]);
  const overLimit = graphemes > WHISTLE_MAX_GRAPHEMES;
  const exhausted = query.data?.remaining === 0;
  const canSend = Boolean(trimmedBody) && !overLimit && !exhausted && !mutation.isPending;

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSend) return;
    mutation.mutate(trimmedBody);
  }

  return (
    <section className="whistle-board" aria-labelledby="whistle-board-title">
      <div className="whistle-board-heading">
        <div>
          <div className="whistle-kicker">Terrace signal</div>
          <h2 id="whistle-board-title">Whistle Board</h2>
        </div>
        {query.data ? (
          <div className="whistle-quota" aria-label={`${query.data.remaining} Whistles remaining`}>
            <strong>
              {query.data.remaining} / {query.data.dailyLimit}
            </strong>
            <span>LEFT · RESET {resetLabel(query.data.resetAt)} UTC</span>
          </div>
        ) : null}
      </div>

      <form className="whistle-composer" onSubmit={submit}>
        <label htmlFor="whistle-body" className="sr-only">
          Send a Whistle
        </label>
        <div className="whistle-input-wrap">
          <input
            id="whistle-body"
            value={body}
            onChange={(event) => setBody(event.target.value)}
            maxLength={132}
            placeholder="33 graphemes. Make it count."
            disabled={exhausted}
            autoComplete="off"
          />
          <span className={overLimit ? 'whistle-counter whistle-counter-over' : 'whistle-counter'}>
            {graphemes}/{WHISTLE_MAX_GRAPHEMES}
          </span>
        </div>
        <button className="whistle-send" type="submit" disabled={!canSend}>
          {mutation.isPending ? 'SIGNALLING…' : exhausted ? 'NO WHISTLES LEFT' : 'WHISTLE'}
        </button>
      </form>

      {overLimit ? (
        <div className="whistle-inline-error" role="alert">
          Keep the signal to {WHISTLE_MAX_GRAPHEMES} graphemes.
        </div>
      ) : mutation.isError ? (
        <div className="whistle-inline-error" role="alert">
          {mutation.error instanceof Error ? mutation.error.message : 'Whistle could not be sent.'}
        </div>
      ) : null}

      <div className="whistle-feed" aria-live="polite">
        {query.isLoading ? (
          <div className="whistle-state">Tuning into the terrace…</div>
        ) : query.isError ? (
          <div className="whistle-state whistle-state-error">
            <strong>Whistle is unavailable.</strong>
            <span>{query.error instanceof Error ? query.error.message : 'Try again shortly.'}</span>
          </div>
        ) : query.data?.items.length ? (
          query.data.items.map((item) => <WhistleRow key={item.id} item={item} />)
        ) : (
          <div className="whistle-state">
            <strong>No signals yet.</strong>
            <span>Be the first voice from your HOOMA today.</span>
          </div>
        )}
      </div>
    </section>
  );
}
