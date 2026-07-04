import { Channel, ContentKind, Weekday } from '../types/channel.js';

export interface PlanItem {
  kind: ContentKind;
  topicRank: number;
}

const WEEKDAYS: Weekday[] = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

/**
 * Decide what a channel produces in this run, from its cadence + the weekday.
 * Distinct kinds get distinct topic ranks so one run doesn't cover the same
 * topic twice on a channel.
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
    plan.push({ kind: 'long', topicRank: rank++ });
  }
  return plan;
}
