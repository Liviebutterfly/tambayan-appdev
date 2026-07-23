import React, { useEffect, useState } from 'react';
import {
  Modal,
  View,
  Text,
  FlatList,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  TextInput,
  Image,
  Alert,
} from 'react-native';
import { supabase } from '../../utils/supabase';
import {
  oneWeekAgo,
  avatarOptions,
  getAvatarIndexFromUrl,
  haversineDistance,
} from '../../utils/helpers';

type Props = {
  visible: boolean;
  onClose: () => void;
  currentLocation: { lat: number; lng: number } | null;
  radiusKm?: number;
  filterUserId?: string | null;
  readOnly?: boolean;
  onPostDeleted?: (post: PostItem) => void;
};

type PostComment = {
  id: string | number;
  content?: string;
  created_at?: string;
  user_id?: string;
  profiles?: { username?: string; avatar_url?: string };
};

type PostItem = {
  id: string | number;
  content: string;
  created_at?: string;
  location?: string | null;
  user_id?: string;
  mood?: string | null;
  image_url?: string | null;
  profiles: { username: string; avatar_url: string; id?: string };
};

export default function FreedomWallModal({
  visible,
  onClose,
  currentLocation,
  radiusKm = 1,
  filterUserId,
  readOnly = false,
  onPostDeleted,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [posts, setPosts] = useState<PostItem[]>([]);
  const [expandedPostIds, setExpandedPostIds] = useState<Record<string, boolean>>({});
  const [commentsByPost, setCommentsByPost] = useState<Record<string, PostComment[]>>({});
  const [commentsLoading, setCommentsLoading] = useState<Record<string, boolean>>({});
  const [likedPost, setLikedPost] = useState<Record<string, boolean>>({});
  const [likeCounts, setLikeCounts] = useState<Record<string, number>>({});
  const [commentCounts, setCommentCounts] = useState<Record<string, number>>({});
  const [commentInputByPost, setCommentInputByPost] = useState<Record<string, string>>({});
  const [commentsSubmitting, setCommentsSubmitting] = useState<Record<string, boolean>>({});
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [deletingPostId, setDeletingPostId] = useState<string | null>(null);
  const [postAvatar, setPostAvatar] = useState<Record<string, number>>({});
  const [reportCounts, setReportCounts] = useState<Record<string, number>>({});
  const [reportedPost, setReportedPost] = useState<Record<string, boolean>>({});

  const moodIconMap: Record<string, any> = {
    nostalgic: require('../../assets/images/happy.png'),
    peaceful: require('../../assets/images/calm.png'),
    romantic: require('../../assets/images/sad.png'),
    motivational: require('../../assets/images/angry.png'),
    // keep old keys as fallback
    happy: require('../../assets/images/happy.png'),
    calm: require('../../assets/images/calm.png'),
    sad: require('../../assets/images/sad.png'),
    angry: require('../../assets/images/angry.png'),
  };

  const moodBackgroundMap: Record<string, string> = {
    nostalgic: '#c1dae0',
    peaceful: '#cef0db',
    romantic: '#f7e4ea',
    motivational: '#f2f0d8',
  };

  const formatMoodLabel = (mood?: string | null) => {
    if (!mood) return '';
    return mood.charAt(0).toUpperCase() + mood.slice(1);
  };

  const resetModalState = () => {
    setPosts([]);
    setExpandedPostIds({});
    setCommentsByPost({});
    setCommentsLoading({});
    setLikedPost({});
    setLikeCounts({});
    setCommentCounts({});
    setCommentInputByPost({});
    setCommentsSubmitting({});
    setDeletingPostId(null);
    setPostAvatar({});
    setReportCounts({});
    setReportedPost({});
  };

  const fetchCountsLikesAndAvatars = async (visiblePosts: PostItem[]) => {
    if (!visiblePosts.length) {
      setLikeCounts({});
      setLikedPost({});
      setCommentCounts({});
      setPostAvatar({});
      return;
    }

    const postIds = visiblePosts.map((p) => String(p.id));
    const {
      data: { session },
    } = await supabase.auth.getSession();

    const { data: likesData } = await supabase
      .from('post_likes')
      .select('*')
      .in('post_id', postIds);

    const likesMap: Record<string, number> = {};
    const likedMap: Record<string, boolean> = {};
    const reportMap: Record<string, number> = {};
    const reportedMap: Record<string, boolean> = {};

    if (likesData) {
      likesData.forEach((like: any) => {
        const pid = String(like.post_id);
        likesMap[pid] = (likesMap[pid] ?? 0) + 1;
        if (session?.user.id && like.user_id === session.user.id) {
          likedMap[pid] = true;
        }
      });
    }

    setLikeCounts((prev) => ({ ...prev, ...likesMap }));
    setLikedPost((prev) => ({ ...prev, ...likedMap }));

    const { data: commentsData } = await supabase
      .from('post_comments')
      .select('*')
      .in('post_id', postIds);

    const { data: reportData } = await supabase
      .from('post_reports')
      .select('*')
      .in('post_id', postIds);

    if (reportData) {
      reportData.forEach((report: any) => {
        const pid = String(report.post_id);
        reportMap[pid] = (reportMap[pid] ?? 0) + 1;
        if (session?.user.id && report.user_id === session.user.id) {
          reportedMap[pid] = true;
        }
      });
    }

    setReportCounts((prev) => ({ ...prev, ...reportMap }));
    setReportedPost((prev) => ({ ...prev, ...reportedMap }));

    const commentsMap: Record<string, number> = {};
    if (commentsData) {
      commentsData.forEach((comment: any) => {
        const pid = String(comment.post_id);
        commentsMap[pid] = (commentsMap[pid] ?? 0) + 1;
      });
    }

    setCommentCounts((prev) => ({ ...prev, ...commentsMap }));

    const avatarsIndexMap: Record<string, number> = {};
    visiblePosts.forEach((post) => {
      const uid = String(post.user_id ?? '');
      if (!uid || avatarsIndexMap[uid] !== undefined) return;

      const avatarIndex = getAvatarIndexFromUrl(post.profiles?.avatar_url ?? null) ?? -1;
      avatarsIndexMap[uid] = avatarIndex;
    });

    setPostAvatar((prev) => ({ ...prev, ...avatarsIndexMap }));
  };

  const toggleLike = async (post: PostItem) => {
    const postId = String(post.id);
    const isLiked = Boolean(likedPost[postId]);
    const nextLiked = !isLiked;

    setLikedPost((prev) => ({ ...prev, [postId]: nextLiked }));
    setLikeCounts((prev) => ({
      ...prev,
      [postId]: (prev[postId] ?? 0) + (nextLiked ? 1 : -1),
    }));

    const {
      data: { session },
    } = await supabase.auth.getSession();
    const userId = session?.user.id;
    if (!userId) return;

    if (nextLiked) {
      const { error } = await supabase
        .from('post_likes')
        .insert({ post_id: post.id, user_id: userId });

      if (error) {
        setLikedPost((prev) => ({ ...prev, [postId]: isLiked }));
        setLikeCounts((prev) => ({
          ...prev,
          [postId]: Math.max((prev[postId] ?? 1) - 1, 0),
        }));
      }
    } else {
      const { error } = await supabase
        .from('post_likes')
        .delete()
        .match({ post_id: post.id, user_id: userId });

      if (error) {
        setLikedPost((prev) => ({ ...prev, [postId]: isLiked }));
        setLikeCounts((prev) => ({
          ...prev,
          [postId]: (prev[postId] ?? 0) + 1,
        }));
      }
    }
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
      .select('*, profiles(username, avatar_url)')
      .eq('post_id', post.id)
      .order('created_at', { ascending: true });

    setCommentsLoading((prev) => ({ ...prev, [postId]: false }));

    if (!error && data) {
      setCommentsByPost((prev) => ({ ...prev, [postId]: data as PostComment[] }));
    }
  };

  const handleDeleteComment = async (postId: string | number, comment: PostComment) => {
    const cid = String(comment.id);
    const isOwner = Boolean(currentUserId && comment.user_id === currentUserId);
    if (!isOwner) return;

    Alert.alert('Delete comment', 'Are you sure you want to delete this comment?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            const { error } = await supabase
              .from('post_comments')
              .delete()
              .eq('id', comment.id);

            if (error) throw error;

            setCommentsByPost((prev) => {
              const next = { ...prev };
              next[String(postId)] = (next[String(postId)] ?? []).filter(
                (c) => String(c.id) !== cid
              );
              return next;
            });

            setCommentCounts((prev) => ({
              ...prev,
              [String(postId)]: Math.max((prev[String(postId)] ?? 1) - 1, 0),
            }));
          } catch (err) {
            console.warn('delete comment error', err);
            Alert.alert('Delete failed', 'Unable to delete this comment right now.');
          }
        },
      },
    ]);
  };

  const addComment = async (post: PostItem) => {
    const postId = String(post.id);
    const text = (commentInputByPost[postId] ?? '').trim();
    if (!text) return;

    const {
      data: { session },
    } = await supabase.auth.getSession();
    const userId = session?.user.id;
    if (!userId) return;

    setCommentsSubmitting((prev) => ({ ...prev, [postId]: true }));

    const { data, error } = await supabase
      .from('post_comments')
      .insert({ post_id: post.id, content: text, user_id: userId })
      .select('*, profiles(username, avatar_url)');

    setCommentsSubmitting((prev) => ({ ...prev, [postId]: false }));

    if (error) {
      console.warn('add comment error', error);
      return;
    }

    const newComment = Array.isArray(data) ? data[0] : data;

    setCommentsByPost((prev) => ({
      ...prev,
      [postId]: [...(prev[postId] ?? []), newComment],
    }));
    setCommentCounts((prev) => ({
      ...prev,
      [postId]: (prev[postId] ?? 0) + 1,
    }));
    setCommentInputByPost((prev) => ({ ...prev, [postId]: '' }));
  };

  const handleReportPost = async (post: PostItem) => {
    const postId = String(post.id);
    const userId = currentUserId;

    if (!userId) {
      Alert.alert('Not signed in', 'Please sign in to report a post.');
      return;
    }

    const isReported = Boolean(reportedPost[postId]);

    if (isReported) {
      const { error: deleteError } = await supabase
        .from('post_reports')
        .delete()
        .eq('post_id', post.id)
        .eq('user_id', userId);

      if (deleteError) {
        console.warn('revoke report post error', deleteError);
        Alert.alert('Unable to undo report', 'Please try again in a moment.');
        return;
      }

      const optimisticCount = Math.max((reportCounts[postId] ?? 1) - 1, 0);
      setReportCounts((prev) => ({ ...prev, [postId]: optimisticCount }));
      setReportedPost((prev) => ({ ...prev, [postId]: false }));

      const { data: reportRows, error: reportQueryError } = await supabase
        .from('post_reports')
        .select('id')
        .eq('post_id', post.id);

      if (!reportQueryError) {
        setReportCounts((prev) => ({ ...prev, [postId]: reportRows?.length ?? optimisticCount }));
      }

      Alert.alert('Report removed', 'Your report has been withdrawn.');
      return;
    }

    const optimisticCount = (reportCounts[postId] ?? 0) + 1;
    setReportedPost((prev) => ({ ...prev, [postId]: true }));
    setReportCounts((prev) => ({ ...prev, [postId]: optimisticCount }));

    const { error } = await supabase
      .from('post_reports')
      .insert({ post_id: post.id, user_id: userId });

    if (error) {
      console.warn('report post error', error);
      setReportedPost((prev) => ({ ...prev, [postId]: false }));
      setReportCounts((prev) => ({ ...prev, [postId]: Math.max((prev[postId] ?? 1) - 1, 0) }));

      if (error.code === '23505' || error.message.toLowerCase().includes('duplicate')) {
        setReportedPost((prev) => ({ ...prev, [postId]: true }));
        Alert.alert('Already reported', 'You already flagged this post once.');
      } else {
        Alert.alert('Report failed', 'Unable to report this post right now.');
      }
      return;
    }

    const { data: reportRows, error: reportQueryError } = await supabase
      .from('post_reports')
      .select('id')
      .eq('post_id', post.id);

    if (reportQueryError) {
      console.warn('report count query error', reportQueryError);
      Alert.alert('Reported', 'Thanks for flagging this post.');
      return;
    }

    const reportCount = reportRows?.length ?? optimisticCount;
    setReportedPost((prev) => ({ ...prev, [postId]: true }));
    setReportCounts((prev) => ({ ...prev, [postId]: reportCount }));

    if (reportCount >= 5) {
      try {
        const { error: deleteError } = await supabase
          .from('posts')
          .delete()
          .eq('id', post.id);

        if (deleteError) throw deleteError;

        if (post.image_url) {
          try {
            const urlParts = post.image_url.split('/');
            const imagesIndex = urlParts.indexOf('images');
            const storagePath =
              imagesIndex >= 0 ? urlParts.slice(imagesIndex + 1).join('/') : null;

            if (storagePath) {
              await supabase.storage.from('images').remove([storagePath]);
            }
          } catch (storageError) {
            console.warn('delete image storage error', storageError);
          }
        }

        setPosts((prev) => prev.filter((item) => String(item.id) !== postId));
        setReportCounts((prev) => {
          const next = { ...prev };
          delete next[postId];
          return next;
        });
        setReportedPost((prev) => {
          const next = { ...prev };
          delete next[postId];
          return next;
        });
        Alert.alert('Post removed', 'This post has reached the report threshold and was deleted.');
      } catch (error: any) {
        console.warn('auto-delete reported post error', error);
        Alert.alert('Report received', 'The post has enough reports, but cleanup could not finish automatically.');
      }
      return;
    }

    Alert.alert('Reported', 'Thanks for flagging this post.');
  };

  const handleDeletePost = async (post: PostItem) => {
    const postId = String(post.id);
    const isOwner = Boolean(currentUserId && post.user_id === currentUserId);
    if (!isOwner) return;

    Alert.alert('Delete post', 'Are you sure you want to delete this post?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          setDeletingPostId(postId);

          try {
            const { error: deleteError } = await supabase
              .from('posts')
              .delete()
              .eq('id', post.id);

            if (deleteError) {
              throw deleteError;
            }

            if (post.image_url) {
              try {
                const urlParts = post.image_url.split('/');
                const imagesIndex = urlParts.indexOf('images');
                const storagePath =
                  imagesIndex >= 0 ? urlParts.slice(imagesIndex + 1).join('/') : null;

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

            setCommentCounts((prev) => {
              const next = { ...prev };
              delete next[postId];
              return next;
            });

            setLikeCounts((prev) => {
              const next = { ...prev };
              delete next[postId];
              return next;
            });

            onPostDeleted?.(post);
          } catch (error: any) {
            console.warn('delete post error', error);
            Alert.alert(
              'Delete failed',
              error?.message ?? 'Unable to delete this post right now.'
            );
          } finally {
            setDeletingPostId(null);
          }
        },
      },
    ]);
  };

  useEffect(() => {
    const loadSession = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      setCurrentUserId(session?.user.id ?? null);
    };

    loadSession();
  }, []);

  useEffect(() => {
    if (!visible) {
      resetModalState();
      return;
    }

    let cancelled = false;

    const load = async () => {
      setLoading(true);

      if (!currentLocation && !filterUserId) {
        if (!cancelled) {
          setPosts([]);
          setLoading(false);
        }
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

      if (cancelled) return;

      setLoading(false);

      if (error) {
        console.warn('fetch posts error', error);
        setPosts([]);
        return;
      }

      if (!data) {
        setPosts([]);
        return;
      }

      const filtered = filterUserId
        ? data
        : data.filter((post: PostItem) => {
            if (!post.location || !currentLocation) return false;

            const parts = String(post.location).split(',');
            if (parts.length < 2) return false;

            const lat = parseFloat(parts[0]);
            const lng = parseFloat(parts[1]);
            if (Number.isNaN(lat) || Number.isNaN(lng)) return false;

            const distance = haversineDistance(
              currentLocation.lat,
              currentLocation.lng,
              lat,
              lng
            );

            return distance <= radiusKm;
          });

      setPosts(filtered);
      await fetchCountsLikesAndAvatars(filtered);
    };

    load();

    return () => {
      cancelled = true;
    };
  }, [visible, radiusKm, currentLocation, filterUserId]);

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
              contentContainerStyle={styles.listContent}
              keyboardShouldPersistTaps="handled"
              ListEmptyComponent={
                <Text style={styles.emptyState}>
                  {filterUserId
                    ? 'No posts from this user yet.'
                    : 'No posts nearby in the last week.'}
                </Text>
              }
              renderItem={({ item }) => {
                const postId = String(item.id);
                const isExpanded = Boolean(expandedPostIds[postId]);
                const isLiked = Boolean(likedPost[postId]);

                const comments = commentsByPost[postId] ?? [];
                const likeCount = likeCounts[postId] ?? 0;
                const commentCount = commentCounts[postId] ?? 0;
                const reportCount = reportCounts[postId] ?? 0;

                const username = item.profiles?.username ?? 'Anon';
                const avatarIndex = postAvatar[String(item.user_id)] ?? -1;
                const hasValidAvatar =
                  avatarIndex >= 0 && avatarIndex < avatarOptions.length;

                return (
                  <View
                    style={[
                      styles.post,
                      { backgroundColor: item.mood ? (moodBackgroundMap[item.mood] ?? '#fff2f1') : '#fff2f1' },
                    ]}
                  >
                    <View style={styles.postRow}>
                      <View style={styles.avatarWrapper}>
                        {hasValidAvatar ? (
                          <Image
                            source={avatarOptions[avatarIndex]}
                            style={styles.avatar}
                          />
                        ) : (
                          <View style={styles.avatarPlaceholder}>
                            <Text style={styles.avatarInitial}>
                              {String(username).charAt(0).toUpperCase()}
                            </Text>
                          </View>
                        )}
                      </View>

                      <View style={styles.postBody}>
                        <View style={styles.postHeaderRow}>
                          <View style={styles.usernameRow}>
                            <Text style={styles.username}>{username}</Text>
                            {item.mood ? (
                              <View style={styles.moodBadge}>
                                <Image
                                  source={moodIconMap[item.mood] ?? moodIconMap.happy}
                                  style={styles.moodIcon}
                                />
                              </View>
                            ) : null}
                          </View>

                          {!readOnly ? (
                            <Pressable
                              onPress={() => handleReportPost(item)}
                              style={[
                                styles.reportButton,
                                reportedPost[postId] && styles.reportButtonActive,
                              ]}
                              disabled={!currentUserId}
                            >
                              <Text style={styles.statsText}>⚑ {reportCount}</Text>
                            </Pressable>
                          ) : null}
                        </View>

                        <Text style={styles.postContent}>{item.content}</Text>

                        {item.image_url ? (
                          <Image
                            source={{ uri: item.image_url }}
                            style={styles.postImage}
                            resizeMode="cover"
                          />
                        ) : null}

                        <Text style={styles.postMeta}>
                          {item.created_at
                            ? new Date(item.created_at).toLocaleString()
                            : ''}
                        </Text>

                        <View style={styles.postActions}>
                          {!readOnly ? (
                            <>
                              <Pressable
                                onPress={() => toggleLike(item)}
                                style={styles.actionButton}
                              >
                                {isLiked ? (
                                  <Text style={styles.statsText}>
                                    ❤️ {likeCount} likes
                                  </Text>
                                ) : (
                                  <Text style={styles.statsText}>
                                    🤍 {likeCount} likes
                                  </Text>
                                )}
                              </Pressable>

                              <Pressable
                                onPress={() => toggleComments(item)}
                                style={styles.actionButton}
                              >
                                <Text style={styles.actionText}>
                                  💬 {commentCount} comments
                                </Text>
                              </Pressable>

                              {currentUserId && item.user_id === currentUserId ? (
                                <Pressable
                                  onPress={() => handleDeletePost(item)}
                                  style={styles.actionButton}
                                  disabled={deletingPostId === postId}
                                >
                                  <Text style={styles.deleteText}>
                                    {deletingPostId === postId
                                      ? 'Deleting...'
                                      : 'Delete'}
                                  </Text>
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
                          comments.map((comment) => {
                            const cUsername = comment.profiles?.username ?? 'Anon';
                            const cAvatarIndex = getAvatarIndexFromUrl(
                              comment.profiles?.avatar_url ?? null
                            );
                            const hasValidCAvatar =
                              cAvatarIndex !== null && cAvatarIndex >= 0 && cAvatarIndex < avatarOptions.length;

                            return (
                              <View key={String(comment.id)} style={styles.commentItem}>
                                <View style={styles.commentRow}>
                                  <View style={styles.commentAvatarWrapper}>
                                    {hasValidCAvatar ? (
                                      <Image
                                        source={avatarOptions[cAvatarIndex!]}
                                        style={styles.commentAvatar}
                                      />
                                    ) : (
                                      <View style={styles.commentAvatarPlaceholder}>
                                        <Text style={styles.avatarInitial}>
                                          {String(cUsername).charAt(0).toUpperCase()}
                                        </Text>
                                      </View>
                                    )}
                                  </View>

                                  <View style={styles.commentBody}>
                                    <View style={styles.commentHeaderRow}>
                                      <Text style={styles.commentUsername}>{cUsername}</Text>
                                      {currentUserId && comment.user_id === currentUserId ? (
                                        <Pressable
                                          onPress={() => handleDeleteComment(item.id, comment)}
                                          style={styles.commentDeleteButton}
                                        >
                                          <Text style={styles.deleteText}>Delete</Text>
                                        </Pressable>
                                      ) : null}
                                    </View>

                                    <Text style={styles.commentText}>
                                      {comment.content ?? 'Comment'}
                                    </Text>
                                    {comment.created_at ? (
                                      <Text style={styles.commentMeta}>
                                        {new Date(comment.created_at).toLocaleString()}
                                      </Text>
                                    ) : null}
                                  </View>
                                </View>
                              </View>
                            );
                          })
                        ) : (
                          <Text style={styles.emptyComments}>No comments yet.</Text>
                        )}

                        <View style={styles.commentInputRow}>
                          <TextInput
                            value={commentInputByPost[postId] ?? ''}
                            onChangeText={(text) =>
                              setCommentInputByPost((prev) => ({
                                ...prev,
                                [postId]: text,
                              }))
                            }
                            placeholder="Write a comment..."
                            placeholderTextColor="#9ca3af"
                            style={styles.commentInput}
                          />
                          <Pressable
                            onPress={() => addComment(item)}
                            style={styles.sendButton}
                            disabled={commentsSubmitting[postId]}
                          >
                            <Text style={{ color: '#fff' }}>
                              {commentsSubmitting[postId] ? '...' : 'Send'}
                            </Text>
                          </Pressable>
                        </View>
                      </View>
                    ) : null}
                  </View>
                );
              }}
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
    justifyContent: 'flex-start',
  },
  card: {
    flex: 1,
    backgroundColor: '#5e688b',
    maxHeight: '100%',
    padding: 16,
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
  listContent: {
    paddingBottom: 16,
  },
  emptyState: {
    color: '#9ca3af',
    marginTop: 12,
  },
  post: {
    padding: 12,
    borderRadius: 12,
    marginBottom: 10,
  },
  postRow: { flexDirection: 'row', alignItems: 'flex-start' },
  avatarWrapper: { width: 44, marginRight: 10 },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#374151' },
  avatarPlaceholder: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#374151',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarInitial: { color: '#fff', fontWeight: '700' },
  postBody: { flex: 1 },
  postHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 4,
  },
  usernameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 0,
    gap: 8,
    flexWrap: 'wrap',
    flexShrink: 1,
  },
  username: { color: '#5e688b', fontWeight: '700' },
  moodBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffdbb7',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
    gap: 4,
  },
  moodIcon: { width: 16, height: 16, borderRadius: 8 },
  moodLabel: { color: '#5e688b', fontSize: 11, fontWeight: '600' },
  postContent: { color: '#5e688b' },
  postImage: {
    width: '100%',
    height: 160,
    borderRadius: 8,
    marginTop: 8,
    backgroundColor: '#ffdbb7',
  },
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
    fontWeight: '600',
  },
  reportButton: {
    backgroundColor: '#fff2f1',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    alignSelf: 'flex-start',
  },
  reportButtonActive: {
    backgroundColor: '#f7d7d7',
  },
  actionButton: {
    paddingVertical: 4,
    paddingHorizontal: 6,
  },
  actionText: {
    color: '#5e688b',
    fontWeight: '600',
    fontSize: 13,
  },
  readOnlyHint: {
    color: '#7a84a0',
    fontSize: 12,
    fontWeight: '600',
  },
  deleteText: {
    color: '#5e688b',
    fontWeight: '600',
    fontSize: 13,
  },
  commentsBox: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#ffdbb7',
    paddingLeft: 54,
  },
  commentItem: {
    paddingVertical: 6,
    paddingLeft: 0,
  },
  commentRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  commentAvatarWrapper: { width: 36, marginRight: 8 },
  commentAvatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#374151' },
  commentAvatarPlaceholder: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#374151',
    justifyContent: 'center',
    alignItems: 'center',
  },
  commentBody: { flex: 1 },
  commentHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  commentUsername: { color: '#5e688b', fontWeight: '700' },
  commentDeleteButton: { paddingHorizontal: 6 },
  commentInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    marginLeft: 0,
  },
  commentInput: {
    flex: 1,
    backgroundColor: '#fff2f1',
    color: '#5e688b',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginRight: 8,
  },
  sendButton: {
    backgroundColor: '#f7a7a8',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  commentText: {
    color: '#5e688b',
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