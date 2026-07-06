import React, { useEffect, useState } from 'react';
import { Modal, View, Text, FlatList, StyleSheet, Pressable, ActivityIndicator, TextInput } from 'react-native';
import { supabase } from '../../utils/supabase';
import { oneWeekAgo } from '../../utils/helpers';

type Props = {
  visible: boolean;
  onClose: () => void;
  currentLocation: { lat: number; lng: number } | null;
  radiusKm?: number;
};

type PostComment = {
  id: string | number;
  content?: string;
  created_at?: string;
  user_id?: string;
};

type PostItem = {
  id: string | number;
  content: string;
  created_at?: string;
  location?: string | null;
  likes_count?: number;
  like_count?: number;
  likes?: number | Array<any> | null;
  comments_count?: number;
  comment_count?: number;
  comments?: PostComment[] | null;
};

function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number) {
  const toRad = (v: number) => (v * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export default function FreedomWallModal({ visible, onClose, currentLocation, radiusKm = 1 }: Props) {
  const [loading, setLoading] = useState(false);
  const [posts, setPosts] = useState<PostItem[]>([]);
  const [expandedPostIds, setExpandedPostIds] = useState<Record<string, boolean>>({});
  const [commentsByPost, setCommentsByPost] = useState<Record<string, PostComment[]>>({});
  const [commentsLoading, setCommentsLoading] = useState<Record<string, boolean>>({});

  const getLikeCount = (post: PostItem) => {
    if (typeof post.likes_count === 'number') return post.likes_count;
    if (typeof post.like_count === 'number') return post.like_count;
    if (typeof post.likes === 'number') return post.likes;
    if (Array.isArray(post.likes)) return post.likes.length;
    return 0;
  };

  const getCommentCount = (post: PostItem) => {
    if (typeof post.comments_count === 'number') return post.comments_count;
    if (typeof post.comment_count === 'number') return post.comment_count;
    if (Array.isArray(post.comments)) return post.comments.length;
    return 0;
  };

  const toggleComments = async (post: PostItem) => {
    const postId = String(post.id);
    const isExpanded = Boolean(expandedPostIds[postId]);
    const nextExpanded = !isExpanded;

    setExpandedPostIds((prev) => ({ ...prev, [postId]: nextExpanded }));

    if (!nextExpanded) return;

    if (commentsByPost[postId] !== undefined || commentsLoading[postId]) return;

    setCommentsLoading((prev) => ({ ...prev, [postId]: true }));

    const { data, error } = await supabase
      .from('post_comments')
      .select('*')
      .eq('post_id', post.id)
      .order('created_at', { ascending: true });

    setCommentsLoading((prev) => ({ ...prev, [postId]: false }));

    if (!error && data) {
      setCommentsByPost((prev) => ({ ...prev, [postId]: data as PostComment[] }));
      return;
    }

    const fallbackComments = Array.isArray(post.comments) ? post.comments : [];
    setCommentsByPost((prev) => ({ ...prev, [postId]: fallbackComments }));
  };

  useEffect(() => {
    if (!visible) return;

    const load = async () => {
      setLoading(true);

      if (!currentLocation) {
        setPosts([]);
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from('posts')
        .select('*')
        .gte('created_at', oneWeekAgo())
        .order('created_at', { ascending: false })
        .limit(200);

      setLoading(false);

      if (error) {
        console.warn('fetch posts error', error);
        return setPosts([]);
      }

      if (!data) return setPosts([]);

      const normalizedPosts = data.map((post: any) => ({
        ...post,
        likes_count: getLikeCount(post),
        comments_count: getCommentCount(post),
      }));

      const filtered = normalizedPosts.filter((post: PostItem) => {
        if (!post.location) return false;
        const parts = String(post.location).split(',');
        if (parts.length < 2) return false;

        const lat = parseFloat(parts[0]);
        const lng = parseFloat(parts[1]);
        if (Number.isNaN(lat) || Number.isNaN(lng)) return false;

        const distance = haversineDistance(currentLocation.lat, currentLocation.lng, lat, lng);
        return distance <= radiusKm;
      });

      setPosts(filtered);
    };

    load();
  }, [visible, radiusKm, currentLocation]);

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.overlay}>
        <View style={styles.card}>
          <View style={styles.header}>
            <Text style={styles.title}>Freedom Wall</Text>
            <Pressable onPress={onClose} style={styles.closeButton}>
              <Text style={styles.closeText}>Close</Text>
            </Pressable>
          </View>

          {loading ? (
            <ActivityIndicator color="#fff" style={{ marginTop: 16 }} />
          ) : (
            <FlatList
              data={posts}
              keyExtractor={(item) => String(item.id)}
              renderItem={({ item }) => {
                const postId = String(item.id);
                const isExpanded = Boolean(expandedPostIds[postId]);
                const comments = commentsByPost[postId] ?? [];
                const likeCount = getLikeCount(item);
                const commentCount = getCommentCount(item);

                return (
                  <View style={styles.post}>
                    <Text style={styles.postContent}>{item.content}</Text>
                    <Text style={styles.postMeta}>{item.created_at ? new Date(item.created_at).toLocaleString() : ''}</Text>

                    <View style={styles.postActions}>
                      <Text style={styles.statsText}>❤️ {likeCount}</Text>
                      <Pressable onPress={() => toggleComments(item)} style={styles.actionButton}>
                        <Text style={styles.actionText}>💬 {commentCount} comments</Text>
                      </Pressable>
                    </View>

                    {isExpanded ? (
                      <View style={styles.commentsBox}>
                        {commentsLoading[postId] ? (
                          <ActivityIndicator color="#60a5fa" />
                        ) : comments.length > 0 ? (
                          comments.map((comment) => (
                            <View key={String(comment.id)} style={styles.commentItem}>
                              <Text style={styles.commentText}>{comment.content ?? 'Comment'}</Text>
                              {comment.created_at ? (
                                <Text style={styles.commentMeta}>{new Date(comment.created_at).toLocaleString()}</Text>
                              ) : null}
                            </View>
                          ))
                        ) : (
                          <Text style={styles.emptyComments}>No comments yet.</Text>
                        )}
                      </View>
                    ) : null}
                  </View>
                );
              }}
              ListEmptyComponent={<Text style={{ color: '#9ca3af', marginTop: 12 }}>No posts nearby in the last week.</Text>}
            />
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    padding: 20,
    justifyContent: 'center',
  },
  card: {
    backgroundColor: '#0b1220',
    borderRadius: 12,
    maxHeight: '80%',
    padding: 12,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  title: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
  closeButton: {},
  closeText: { color: '#60a5fa', fontWeight: '600' },
  post: {
    padding: 12,
    borderRadius: 8,
    backgroundColor: '#0f1724',
    marginBottom: 8,
  },
  postContent: { color: '#f8fafc' },
  postMeta: { color: '#94a3b8', marginTop: 6, fontSize: 12 },
  postActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 10,
  },
  statsText: {
    color: '#f8fafc',
    fontSize: 13,
  },
  actionButton: {
    paddingVertical: 4,
    paddingHorizontal: 6,
  },
  actionText: {
    color: '#60a5fa',
    fontWeight: '600',
    fontSize: 13,
  },
  commentsBox: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#1f2937',
  },
  commentItem: {
    paddingVertical: 6,
  },
  commentText: {
    color: '#e5e7eb',
  },
  commentMeta: {
    color: '#94a3b8',
    fontSize: 11,
    marginTop: 2,
  },
  emptyComments: {
    color: '#9ca3af',
    fontSize: 12,
  },
});
