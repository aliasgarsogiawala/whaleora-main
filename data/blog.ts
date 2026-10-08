import type { BlogPost } from '@/lib/content/types';

/**
 * Starter posts for the journal. They seed the studio the first time it loads
 * without any saved posts; after that, the admin content is the only source.
 */
export const starterPosts: BlogPost[] = [
  {
    id: 'post-ten-minute-plan',
    slug: 'the-ten-minute-safety-plan',
    title: 'The ten-minute safety plan',
    excerpt: 'Most of being prepared is deciding a few things once, in advance, so you are not deciding them under pressure.',
    category: 'Everyday Safety',
    author: 'Whaleora Team',
    date: '2026-09-01',
    coverImage: '/stock/journey-city.webp',
    body: `Personal safety is rarely about living on alert. Nobody can sustain that, and it makes ordinary days worse. What actually helps is making a handful of decisions once, calmly, so they are already made when it matters.

## Pick two people

Choose two contacts who will pick up at odd hours, and tell them they are on your list. Save them as favourites so they are one tap away, and write their numbers down somewhere that is not your phone.

## Decide where things live

Keys, phone, alarm, cards. If each has one pocket, you can find them without looking and notice when one is missing.

- Keys and alarm on the same ring
- Phone in the pocket you can reach with either hand
- A little cash separate from your wallet

## Know your route home

Have a default way back from the places you go most, and a second option for when the first one feels wrong. You do not need a reason to switch.

That is the whole plan. Ten minutes once, and a quick check whenever your routine changes.`,
    visible: true,
  },
  {
    id: 'post-late-commute',
    slug: 'a-calmer-late-commute',
    title: 'A calmer late commute',
    excerpt: 'Small, practical habits for the days that run later than planned — on trains, in cabs and on the walk home.',
    category: 'Commute',
    author: 'Whaleora Team',
    date: '2026-09-15',
    coverImage: '/stock/journey-train.webp',
    body: `Late evenings are when most of us are tired, distracted and in a hurry to get home. A few habits take the guesswork out of the journey.

## Before you leave

Charge your phone above 30 percent if you can, and share your trip or live location with someone you trust. Check the last train or bus time rather than assuming it.

## On the way

Sit near the driver or in a busier carriage. Keep one ear free if you are listening to something. If a cab's number plate does not match the app, do not get in — cancel and rebook.

- Confirm the driver's name before you say yours
- Sit behind the passenger seat
- Keep your bag on your lap, not the seat beside you

## The last stretch

Have your keys in hand before you reach your door, and let your contact know you are home. It is a small message, and it closes the loop.`,
    visible: true,
  },
];
