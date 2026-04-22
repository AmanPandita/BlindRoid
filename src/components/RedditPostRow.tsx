import { Linking, Pressable, Text, View } from 'react-native';

import { styles } from '../styles/styles';
import { RedditPost } from '../types';
import { formatRedditDate } from '../utils/format';

type Props = {
  isExpanded: boolean;
  onToggle: () => void;
  post: RedditPost;
};

export function RedditPostRow({ isExpanded, onToggle, post }: Props) {
  const date = new Date(post.created * 1000);

  return (
    <View>
      <Pressable
        onPress={onToggle}
        style={[styles.redditPostRow, isExpanded && styles.redditPostRowExpanded]}
      >
        <View style={styles.redditPostHeader}>
          <View style={styles.redditMetaRow}>
            <Text style={styles.redditSubreddit}>r/{post.subreddit}</Text>
            <Text style={styles.redditAuthor}>u/{post.author}</Text>
            <Text style={styles.redditDate}>{formatRedditDate(post.created)}</Text>
          </View>
          <Text style={styles.redditTitle} numberOfLines={isExpanded ? undefined : 2}>
            {post.title}
          </Text>
          <View style={styles.redditStats}>
            <Text style={styles.redditScore}>▲ {post.score}</Text>
            <Text style={styles.redditComments}>💬 {post.num_comments}</Text>
          </View>
        </View>
        <Text style={styles.expandIndicator}>{isExpanded ? '▼' : '▶'}</Text>
      </Pressable>

      {isExpanded && (
        <View style={styles.redditPostDetails}>
          {post.selftext ? (
            <View style={styles.redditSelfText}>
              <Text style={styles.redditSelfTextContent} numberOfLines={10}>
                {post.selftext}
              </Text>
            </View>
          ) : null}
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Posted</Text>
            <Text style={styles.detailValue}>
              {date.toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                hour: 'numeric',
                minute: '2-digit',
              })}
            </Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Score</Text>
            <Text style={styles.detailValue}>{post.score.toLocaleString()}</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Comments</Text>
            <Text style={styles.detailValue}>{post.num_comments.toLocaleString()}</Text>
          </View>
          <Pressable
            style={styles.redditLinkButton}
            onPress={() =>
              Linking.openURL(post.permalink).catch((err) =>
                console.error('Failed to open URL:', err)
              )
            }
          >
            <Text style={styles.redditLinkButtonText}>View on Reddit →</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}
