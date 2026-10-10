import { describe, expect, it } from 'vitest';
import { diversify } from '../src/background/feed/FeedDiversity';
import { candidate, channelId, videoId } from './helpers';

describe('diversify', () => {
  it('caps items per channel', () => {
    const videos = Array.from({ length: 5 }, (_, index) =>
      candidate({ videoId: videoId(index + 1), channelId: channelId('a') }),
    );
    const output = diversify(videos, { maxPerChannel: 2 });
    expect(output).toHaveLength(2);
  });

  it('keeps other channels flowing after a dominant one', () => {
    const videos = [
      candidate({ videoId: videoId(1), channelId: channelId('a') }),
      candidate({ videoId: videoId(2), channelId: channelId('a') }),
      candidate({ videoId: videoId(3), channelId: channelId('a') }),
      candidate({ videoId: videoId(4), channelId: channelId('b') }),
      candidate({ videoId: videoId(5), channelId: channelId('c') }),
    ];
    const output = diversify(videos, { maxPerChannel: 2 });
    expect(output.map((video) => video.videoId)).toEqual([
      videoId(1),
      videoId(2),
      videoId(4),
      videoId(5),
    ]);
  });

  it('honours a category ceiling', () => {
    const videos = Array.from({ length: 5 }, (_, index) =>
      candidate({
        videoId: videoId(index + 1),
        channelId: channelId(String.fromCharCode(97 + index)),
        categoryId: '28',
      }),
    );
    const output = diversify(videos, { maxPerChannel: 5, maxPerCategory: 2 });
    expect(output).toHaveLength(2);
  });

  it('preserves order and keeps everything under the caps', () => {
    const videos = Array.from({ length: 3 }, (_, index) =>
      candidate({
        videoId: videoId(index + 1),
        channelId: channelId(String.fromCharCode(97 + index)),
      }),
    );
    const output = diversify(videos, { maxPerChannel: 2 });
    expect(output.map((video) => video.videoId)).toEqual([videoId(1), videoId(2), videoId(3)]);
  });
});
