import { Channel, ContentKind, Weekday } from '../types/channel';

export interface PlanItem {
  kind: ContentKind;
  topicRank: number;
  derivedFromChapter?: number;
}

const WEEKDAYS: Weekday[] = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

/**
 * Decide what a channel produces in this run, from its cadence + the weekday.
 * Distinct kinds get distinct topic ranks so one run doesn't cover the same
 * topic twice on a channel. On long-form days, up to `deriveShorts` vertical
 * shorts are cut from the long video's chapters (same topic — they are the
 * funnel for that video, not separate coverage).
 */
export function planContent(channel: Channel, now = new Date()): PlanItem[] {
  const plan: PlanItem[] = [];
  let rank = 0;
  for (let i = 0; i < channel.cadence.short.perRun; i++) {
    plan.push({ kind: 'short', topicRank: rank++ });
  }
  for (let i = 0; i < channel.cadence.image_post.perRun; i++) {
    plan.push({ kind: 'image_post', topicRank: rank++ });
  }
  const today = WEEKDAYS[now.getUTCDay()];
  if (channel.cadence.long.days.includes(today)) {
    const longRank = rank++;
    plan.push({ kind: 'long', topicRank: longRank });
    for (let i = 0; i < channel.cadence.long.deriveShorts; i++) {
      plan.push({ kind: 'short', topicRank: longRank, derivedFromChapter: i });
    }
  }
  return plan;
}
