import React, { useEffect, useState } from 'react';
import { Modal, View, Text, FlatList, StyleSheet, Pressable, ActivityIndicator, TextInput, Image, Alert } from 'react-native';
import { supabase } from '../../utils/supabase';
import { oneWeekAgo, avatarOptions, getAvatarIndexFromUrl, haversineDistance} from '../../utils/helpers';

type Props = {
  visible: boolean;
  onClose: () => void;
  currentLocation: { lat: number; lng: number } | null;
  radiusKm?: number;
  filterUserId?: string | null;
  readOnly?: boolean;
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
  mood?: string | null;
  image_url?: string | null;
  profiles?: { username?: string; avatar_url?: string; id?: string };
};


export default function FreedomWallModal({ visible, onClose, currentLocation, radiusKm = 1, filterUserId, readOnly = false }: Props) {
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
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [deletingPostId, setDeletingPostId] = useState<string | null>(null);

  //for setting avatar index for each post
  const [postAvatar, setPostAvatar] = useState<Record<string, number>>({});

  const moodIconMap: Record<string, string> = {
    happy: 'https://placehold.co/24x24/ffd166/1f2937?text=😊',
    calm: 'https://placehold.co/24x24/8ecae6/1f2937?text=🌿',
    sad: 'https://placehold.co/24x24/9db4f5/1f2937?text=☁️',
    angry: 'https://placehold.co/24x24/fa8072/1f2937?text=🔥',
  };

  const formatMoodLabel = (mood?: string | null) => {
    if (!mood) return '';
    return mood.charAt(0).toUpperCase() + mood.slice(1);
  };

  const fetchCounts_Likes_Avatars = async (posts: PostItem[]) => {
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
    
    // fetch avatars for users in posts

    const avatarsIndexMap: Record<string, number> = {};
    posts.forEach((a: any) => {
      const uid = String(a.user_id);
      if(!(uid in avatarsIndexMap))
        avatarsIndexMap[uid] = getAvatarIndexFromUrl(a.profiles?.avatar_url ?? null) ?? 0;
    });
    setPostAvatar((prev) => ({ ...prev, ...avatarsIndexMap }));
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

  const handleDeletePost = async (post: PostItem) => {
    const postId = String(post.id);
    const isOwner = currentUserId && post.user_id === currentUserId;
    if (!isOwner) return;

    Alert.alert('Delete post', 'Are you sure you want to delete this post?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          setDeletingPostId(postId);

          try {
            const { error: deleteError } = await supabase.from('posts').delete().eq('id', post.id);
            if (deleteError) {
              throw deleteError;
            }

            if (post.image_url) {
              try {
                const urlParts = post.image_url.split('/');
                const imagesIndex = urlParts.indexOf('images');
                const storagePath = urlParts.slice(imagesIndex + 1).join('/');
                if (storagePath) {
                  await supabase.storage.from('images').remove([storagePath]);
                }
              } catch (storageError) {
                console.warn('delete image storage error', storageError);
              }
            }

            setPosts((prev) => prev.filter((item) => String(item.id) !== postId));
            setExpandedPostIds((prev) => {
              const next = { ...prev };
              delete next[postId];
              return next;
            });
            setCommentsByPost((prev) => {
              const next = { ...prev };
              delete next[postId];
              return next;
            });
          } catch (error: any) {
            console.warn('delete post error', error);
            Alert.alert('Delete failed', error?.message ?? 'Unable to delete this post right now.');
          } finally {
            setDeletingPostId(null);
          }
        },
      },
    ]);
  };

  useEffect(() => {
    const loadSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setCurrentUserId(session?.user.id ?? null);
    };

    loadSession();
  }, []);

  useEffect(() => {
    if (!visible) return;

    const load = async () => {
      setLoading(true);

      if (!currentLocation && !filterUserId) {
        setPosts([]);
        setLoading(false);
        return;
      }

      let query = supabase
        .from('posts')
        .select('*, profiles(username, avatar_url)')
        .order('created_at', { ascending: false })
        .limit(200);

      if (filterUserId) {
        query = query.eq('user_id', filterUserId);
      } else {
        query = query.gte('created_at', oneWeekAgo());
      }

      const { data, error } = await query;

      setLoading(false);

      if (error) {
        console.warn('fetch posts error', error);
        return setPosts([]);
      }

      if (!data) return setPosts([]);

      const filtered = filterUserId
        ? data
        : data.filter((post: PostItem) => {
            if (!post.location || !currentLocation) return false;
            const parts = String(post.location).split(',');
            if (parts.length < 2) return false;

            const lat = parseFloat(parts[0]);
            const lng = parseFloat(parts[1]);
            if (Number.isNaN(lat) || Number.isNaN(lng)) return false;

            const distance = haversineDistance(currentLocation.lat, currentLocation.lng, lat, lng);
            return distance <= radiusKm;
          });

      setPosts(filtered);
      await fetchCounts_Likes_Avatars(filtered);
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

                const username = item.profiles?.username ?? item.user_id ?? 'Anon';
              
                const index = postAvatar[String(item.user_id)] 

                return (
  
                  <View style={styles.post}>
                    <View style={styles.postRow}>
      
                      <View style={styles.avatarWrapper}>
                        {index !== -1 ? (
                          <Image source={avatarOptions[index]} style={styles.avatar}/>
                        ) : (
                          <View style={styles.avatarPlaceholder}>
                            <Text style={styles.avatarInitial}>{String(username).charAt(0).toUpperCase()}</Text>
                          </View>
                        )}
                  
                      </View>

                      <View style={styles.postBody}>
                        <View style={styles.usernameRow}>
                          <Text style={styles.username}>{username}</Text>
                          {item.mood ? (
                            <View style={styles.moodBadge}>
                              <Image source={{ uri: moodIconMap[item.mood] ?? moodIconMap.happy }} style={styles.moodIcon} />
                              <Text style={styles.moodLabel}>{formatMoodLabel(item.mood)}</Text>
                            </View>
                          ) : null}
                        </View>
                        <Text style={styles.postContent}>{item.content}</Text>
                        {item.image_url ? (
                          <Image source={{ uri: item.image_url }} style={styles.postImage} resizeMode="cover" />
                        ) : null}
                        <Text style={styles.postMeta}>{item.created_at ? new Date(item.created_at).toLocaleString() : ''}</Text>

                        <View style={styles.postActions}>
                          {!readOnly ? (
                            <>
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
                              {currentUserId && item.user_id === currentUserId ? (
                                <Pressable onPress={() => handleDeletePost(item)} style={styles.actionButton} disabled={deletingPostId === postId}>
                                  <Text style={styles.deleteText}>{deletingPostId === postId ? 'Deleting...' : 'Delete'}</Text>
                                </Pressable>
                              ) : null}
                            </>
                          ) : (
                            <Text style={styles.readOnlyHint}>Viewing only</Text>
                          )}
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
              ListEmptyComponent={<Text style={{ color: '#9ca3af', marginTop: 12 }}>{filterUserId ? 'No posts from this user yet.' : 'No posts nearby in the last week.'}</Text>}
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
    backgroundColor: 'rgba(94, 104, 139, 0.78)',
    padding: 0,
    justifyContent: 'flex-start',
  },
  card: {
    flex: 1,
    backgroundColor: '#5e688b',
    borderRadius: 0,
    maxHeight: '100%',
    padding: 16,
    margin: 0,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  title: {
    color: '#fff2f1',
    fontSize: 18,
    fontWeight: '700',
  },
  closeButton: {},
  closeText: { color: '#fff2f1', fontWeight: '600' },
  post: {
    padding: 12,
    borderRadius: 12,
    backgroundColor: '#fff2f1',
    marginBottom: 10,
  },
  postRow: { flexDirection: 'row', alignItems: 'flex-start' },
  avatarWrapper: { width: 44, marginRight: 10 },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#374151' },
  avatarPlaceholder: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#374151', justifyContent: 'center', alignItems: 'center' },
  avatarInitial: { color: '#fff', fontWeight: '700' },
  postBody: { flex: 1 },
  usernameRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 4, gap: 8, flexWrap: 'wrap' },
  username: { color: '#5e688b', fontWeight: '700' },
  moodBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#ffdbb7', borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3, gap: 4 },
  moodIcon: { width: 16, height: 16, borderRadius: 8 },
  moodLabel: { color: '#5e688b', fontSize: 11, fontWeight: '600' },
  postContent: { color: '#5e688b' },
  postImage: { width: '100%', height: 160, borderRadius: 8, marginTop: 8, backgroundColor: '#ffdbb7' },
  postMeta: { color: '#7a84a0', marginTop: 6, fontSize: 12 },
  postActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 10,
  },
  statsText: {
    color: '#5e688b',
    fontSize: 13,
  },
  actionButton: {
    paddingVertical: 4,
    paddingHorizontal: 6,
  },
  actionText: {
    color: '#f7a7a8',
    fontWeight: '600',
    fontSize: 13,
  },
  readOnlyHint: {
    color: '#7a84a0',
    fontSize: 12,
    fontWeight: '600',
  },
  deleteText: {
    color: '#f7a7a8',
    fontWeight: '600',
    fontSize: 13,
  },
  commentsBox: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#ffdbb7',
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
  commentInput: { flex: 1, backgroundColor: '#fff2f1', color: '#5e688b', paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8, marginRight: 8 },
  sendButton: { backgroundColor: '#f7a7a8', paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8 },
  commentText: {
    color: '#111827',
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
