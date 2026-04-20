import { useState } from 'react';
import { Text, View } from 'react-native';

import { noticeRanges } from '../constants';
import { useRedditData } from '../hooks/useRedditData';
import { styles } from '../styles/styles';
import { NoticeRangeKey } from '../types';
import { filterRedditPosts, getRedditPostsForRange } from '../utils/reddit';
import { RedditPostRow } from '../components/RedditPostRow';
import { ScreenShell } from '../components/ScreenShell';
import { Section } from '../components/Section';
import { SegmentedControl } from '../components/SegmentedControl';

// ─── Wrapper (owns data fetching) ──────────────────────────────────────────

export function RedditScreenWrapper() {
  const { error, handleRefresh, loading, posts, refreshing } = useRedditData();
  const [searchQuery, setSearchQuery] = useState('');

  return (
    <ScreenShell
      error={error}
      loading={loading}
      onRefresh={handleRefresh}
      onSearchChange={setSearchQuery}
      refreshing={refreshing}
      searchPlaceholder="Search Reddit posts"
      searchValue={searchQuery}
    >
      <RedditScreen posts={posts} searchQuery={searchQuery} />
    </ScreenShell>
  );
}

// ─── Screen ────────────────────────────────────────────────────────────────

type ScreenProps = { posts: ReturnType<typeof useRedditData>['posts']; searchQuery: string };

function RedditScreen({ posts, searchQuery }: ScreenProps) {
  const [expandedPost, setExpandedPost] = useState<string | null>(null);
  const [range, setRange] = useState<NoticeRangeKey>('30d');

  const rangeFilteredPosts = getRedditPostsForRange(posts, range);
  const filteredPosts = filterRedditPosts(rangeFilteredPosts, searchQuery);

  const rangeTitle =
    range === '7d' ? 'Reddit discussions, last 7 days'
    : range === '30d' ? 'Reddit discussions, last 30 days'
    : 'Reddit discussions, all time';

  return (
    <View style={styles.screen}>
      <SegmentedControl options={noticeRanges} selected={range} onSelect={setRange} />
      <Section eyebrow="Community Source" title={rangeTitle}>
        {filteredPosts.length ? (
          filteredPosts.map((post) => (
            <RedditPostRow
              key={post.id}
              isExpanded={expandedPost === post.id}
              onToggle={() => setExpandedPost(expandedPost === post.id ? null : post.id)}
              post={post}
            />
          ))
        ) : (
          <Text style={styles.emptyText}>No Reddit posts found for this time period.</Text>
        )}
      </Section>
    </View>
  );
}
