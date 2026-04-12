import { createLogger } from '../../content/core/logger.js';

const log = createLogger('comments');
/**
 * API function to handle blog comments using Cloudflare D1
 */

import { errorJsonResponse, jsonResponse } from './_response.js';

export async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const postId = url.searchParams.get('post_id');

  if (!postId) {
    return errorJsonResponse('Missing post_id', {
      status: 400,
    });
  }

  try {
    const db = env.DB_LIKES; // Sharing the same DB binding for simplicity, or use a separate if configured

    if (!db) {
      return jsonResponse({ comments: [], _warning: 'DB not bound' });
    }

    const { results } = await db
      .prepare(
        'SELECT id, author_name, content, created_at FROM blog_comments WHERE post_id = ? ORDER BY created_at DESC',
      )
      .bind(postId)
      .all();

    return jsonResponse({ comments: results });
  } catch (error) {
    log.error('Error fetching comments:', error);
    return errorJsonResponse('Internal Server Error', {
      status: 500,
    });
  }
}

export async function onRequestPost(context) {
  const { request, env } = context;

  try {
    const body = await request.json();
    const { post_id, author_name, content } = body;

    if (!post_id || !author_name || !content) {
      return errorJsonResponse('Missing required fields', {
        status: 400,
      });
    }

    // Basic spam protection: simple length check
    if (content.length > 1000 || author_name.length > 50) {
      return errorJsonResponse('Content too long', {
        status: 400,
      });
    }

    const db = env.DB_LIKES;

    if (!db) {
      return errorJsonResponse('Database not available', {
        status: 500,
      });
    }

    const result = await db
      .prepare(
        'INSERT INTO blog_comments (post_id, author_name, content) VALUES (?, ?, ?) RETURNING id, created_at',
      )
      .bind(post_id, author_name, content)
      .first();

    return jsonResponse(
      {
        success: true,
        comment: {
          id: result.id,
          post_id,
          author_name,
          content,
          created_at: result.created_at,
        },
      },
      { status: 201 },
    );
  } catch (error) {
    log.error('Error adding comment:', error);
    return errorJsonResponse('Internal Server Error', {
      status: 500,
    });
  }
}
