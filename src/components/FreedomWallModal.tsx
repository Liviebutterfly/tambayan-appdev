import React, { useEffect, useState } from 'react';
import { Modal, View, Text, FlatList, StyleSheet, Pressable, ActivityIndicator, TextInput, Image } from 'react-native';
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
  user_id?: string;
  profiles?: { username?: string; avatar_url?: string; id?: string };
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
  // for the post likes
  const [likedPost, setLikedPost] = useState<Record<string, boolean>>({});
  const [likeCounts, setLikeCounts] = useState<Record<string, number>>({});
  const [commentCounts, setCommentCounts] = useState<Record<string, number>>({});
  const [commentInputByPost, setCommentInputByPost] = useState<Record<string, string>>({});
  const [commentsSubmitting, setCommentsSubmitting] = useState<Record<string, boolean>>({});

  const fetchCountsAndLikes = async (posts: PostItem[]) => {
    const postIds = posts.map((p) => p.id);
    const { data: { session } } = await supabase.auth.getSession();

    // fetch likes for these posts
    const { data: likesData } = await supabase
      .from('post_likes')
      .select('*')
      .in('post_id', postIds);

    const likesMap: Record<string, number> = {};
    const likedMap: Record<string, boolean> = {};
    if (likesData) {
      likesData.forEach((l: any) => {
        const pid = String(l.post_id);
        likesMap[pid] = (likesMap[pid] ?? 0) + 1;
        if (session?.user.id && l.user_id === session.user.id) likedMap[pid] = true;
      });
    }

    setLikeCounts((prev) => ({ ...prev, ...likesMap }));
    setLikedPost((prev) => ({ ...prev, ...likedMap }));

    // fetch comments counts for these posts
    const { data: commentsData } = await supabase
      .from('post_comments')
      .select('*')
      .in('post_id', postIds);

    const commentsMap: Record<string, number> = {};
    if (commentsData) {
      commentsData.forEach((c: any) => {
        const pid = String(c.post_id);
        commentsMap[pid] = (commentsMap[pid] ?? 0) + 1;
      });
    }
    setCommentCounts((prev) => ({ ...prev, ...commentsMap }));
  };

  const toggleLike = async (post: PostItem) => {
    const postId = String(post.id);
    const isLiked = Boolean(likedPost[postId]);
    const nextLiked = !isLiked;

    // optimistic UI update
    setLikedPost((prev) => ({ ...prev, [postId]: nextLiked }));
    setLikeCounts((prev) => ({ ...prev, [postId]: (prev[postId] ?? 0) + (nextLiked ? 1 : -1) }));

    const { data: { session } } = await supabase.auth.getSession();
    const userId = session?.user.id;
    if (!userId) return;

    if (nextLiked) {
      const { error } = await supabase.from('post_likes').insert({ post_id: post.id, user_id: userId });
      if (error) {
        // rollback on error
        setLikedPost((prev) => ({ ...prev, [postId]: isLiked }));
        setLikeCounts((prev) => ({ ...prev, [postId]: (prev[postId] ?? 1) - 1 }));
      }
    } else {
      const { error } = await supabase.from('post_likes').delete().match({ post_id: post.id, user_id: userId });
      if (error) {
        setLikedPost((prev) => ({ ...prev, [postId]: isLiked }));
        setLikeCounts((prev) => ({ ...prev, [postId]: (prev[postId] ?? 0) + 1 }));
      }
    }
  }

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
  };

  const addComment = async (post: PostItem) => {
    const postId = String(post.id);
    const text = (commentInputByPost[postId] ?? '').trim();
    if (!text) return;

    const { data: { session } } = await supabase.auth.getSession();
    const userId = session?.user.id;
    if (!userId) return;

    setCommentsSubmitting((prev) => ({ ...prev, [postId]: true }));

    const { data, error } = await supabase
      .from('post_comments')
      .insert({ post_id: post.id, content: text, user_id: userId })
      .select('*');

    setCommentsSubmitting((prev) => ({ ...prev, [postId]: false }));

    if (error) {
      console.warn('add comment error', error);
      return;
    }

    const newComment = Array.isArray(data) ? data[0] : data;

    setCommentsByPost((prev) => ({ ...prev, [postId]: [...(prev[postId] ?? []), newComment] }));
    setCommentCounts((prev) => ({ ...prev, [postId]: (prev[postId] ?? 0) + 1 }));
    setCommentInputByPost((prev) => ({ ...prev, [postId]: '' }));
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
        .select('*, profiles(username, avatar_url)')
        .gte('created_at', oneWeekAgo())
        .order('created_at', { ascending: false })
        .limit(200);

      setLoading(false);

      if (error) {
        console.warn('fetch posts error', error);
        return setPosts([]);
      }

      if (!data) return setPosts([]);
    
      const filtered = data.filter((post: PostItem) => {
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
      await fetchCountsAndLikes(filtered);
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
                const isLiked = Boolean(likedPost[postId]);

                const comments = commentsByPost[postId] ?? [];
                const likeCount = likeCounts[postId] ?? 0;
                const commentCount = commentCounts[postId] ?? 0;

                const avatarUrl = item.profiles?.avatar_url ?? null;
                const username = item.profiles?.username ?? item.user_id ?? 'Anon';

                return (
                  <View style={styles.post}>
                    <View style={styles.postRow}>
                      <View style={styles.avatarWrapper}>
                        {avatarUrl ? (
                          <Image source={{ uri: avatarUrl }} style={styles.avatar} />
                        ) : (
                          <View style={styles.avatarPlaceholder}>
                            <Text style={styles.avatarInitial}>{String(username).charAt(0).toUpperCase()}</Text>
                          </View>
                        )}
                      </View>

                      <View style={styles.postBody}>
                        <Text style={styles.username}>{username}</Text>
                        <Text style={styles.postContent}>{item.content}</Text>
                        <Text style={styles.postMeta}>{item.created_at ? new Date(item.created_at).toLocaleString() : ''}</Text>

                        <View style={styles.postActions}>
                          <Pressable onPress={() => toggleLike(item)} style={styles.actionButton}>
                            {isLiked ? (
                              <Text style={styles.statsText}>❤️ {likeCount} likes</Text>
                            ) : (
                              <Text style={styles.statsText}>🤍 {likeCount} likes</Text>
                            )}
                          </Pressable>
                          <Pressable onPress={() => toggleComments(item)} style={styles.actionButton}>
                            <Text style={styles.actionText}>💬 {commentCount} comments</Text>
                          </Pressable>
                        </View>
                      </View>
                    </View>

                    {isExpanded ? (
                      <View style={styles.commentsBox}>
                        {commentsLoading[postId] ? (
                          <ActivityIndicator color="#60a5fa" />
                        ) : comments.length > 0 ? (
                          comments.map((comment) => (
                            <View key={String(comment.id)} style={styles.commentItemIndented}>
                              <Text style={styles.commentText}>{comment.content ?? 'Comment'}</Text>
                              {comment.created_at ? (
                                <Text style={styles.commentMeta}>{new Date(comment.created_at).toLocaleString()}</Text>
                              ) : null}
                            </View>
                          ))
                        ) : (
                          <Text style={styles.emptyComments}>No comments yet.</Text>
                        )}

                        <View style={styles.commentInputRow}>
                          <TextInput
                            value={commentInputByPost[postId] ?? ''}
                            onChangeText={(t) => setCommentInputByPost((prev) => ({ ...prev, [postId]: t }))}
                            placeholder="Write a comment..."
                            placeholderTextColor="#9ca3af"
                            style={styles.commentInput}
                          />
                          <Pressable onPress={() => addComment(item)} style={styles.sendButton} disabled={commentsSubmitting[postId]}>
                            <Text style={{ color: '#fff' }}>{commentsSubmitting[postId] ? '...' : 'Send'}</Text>
                          </Pressable>
                        </View>
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
    maxHeight: '92%',
    padding: 12,
    marginTop: 40,
    marginBottom: 56,
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
  postRow: { flexDirection: 'row', alignItems: 'flex-start' },
  avatarWrapper: { width: 44, marginRight: 10 },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#374151' },
  avatarPlaceholder: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#374151', justifyContent: 'center', alignItems: 'center' },
  avatarInitial: { color: '#fff', fontWeight: '700' },
  postBody: { flex: 1 },
  username: { color: '#fff', fontWeight: '700', marginBottom: 4 },
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
  commentItemIndented: {
    paddingVertical: 6,
    marginLeft: 54,
    borderLeftWidth: 2,
    borderLeftColor: '#111827',
    paddingLeft: 10,
  },
  commentInputRow: { flexDirection: 'row', alignItems: 'center', marginTop: 8, marginLeft: 54 },
  commentInput: { flex: 1, backgroundColor: '#071025', color: '#fff', paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8, marginRight: 8 },
  sendButton: { backgroundColor: '#2563eb', paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8 },
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
