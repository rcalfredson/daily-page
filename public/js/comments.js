(function () {
  function uiPath(path) {
    const uiBaseRaw = document.body?.dataset.uiBase || '';
    const uiBase = uiBaseRaw.endsWith('/') ? uiBaseRaw.slice(0, -1) : uiBaseRaw;
    return path.startsWith('/') ? `${uiBase}${path}` : `${uiBase}/${path}`;
  }

  function buildCommentItem(comment, byLabel, locale) {
    const item = document.createElement('li');
    item.className = 'comments-list__item';

    const article = document.createElement('article');
    article.className = 'comment';

    const header = document.createElement('header');
    header.className = 'comment__meta';

    const author = document.createElement('span');
    author.className = 'comment__author';

    const byline = document.createElement('span');
    byline.className = 'comment__byline';
    byline.textContent = `${byLabel} `;

    const username = comment.authorProfilePath
      ? document.createElement('a')
      : document.createElement('span');
    username.className = comment.authorProfilePath
      ? 'comment__username user-profile-link'
      : 'comment__username';
    username.textContent = comment.authorUsername || 'Unknown';
    if (comment.authorProfilePath) {
      username.href = uiPath(comment.authorProfilePath);
    }

    author.appendChild(byline);
    author.appendChild(username);

    const time = document.createElement('time');
    time.className = 'comment__time';
    const createdAt = new Date(comment.createdAt);
    time.dateTime = createdAt.toISOString();
    time.textContent = new Intl.DateTimeFormat(locale || 'en', {
      dateStyle: 'medium',
      timeStyle: 'short'
    }).format(createdAt);

    header.appendChild(author);
    header.appendChild(time);

    const body = document.createElement('div');
    body.className = 'comment__body';

    const paragraph = document.createElement('p');
    paragraph.textContent = comment.body || '';
    body.appendChild(paragraph);

    article.appendChild(header);
    article.appendChild(body);
    item.appendChild(article);

    return item;
  }

  async function loadMore(section) {
    const button = section.querySelector('[data-comments-load-more]');
    const list = section.querySelector('[data-comments-list]');
    const error = section.querySelector('[data-comments-load-error]');

    if (!button || !list) return;

    const blockId = section.dataset.blockId;
    const endpoint = section.dataset.apiEndpoint;
    const totalCount = Number(section.dataset.totalCount || '0');
    const pageSize = Number(section.dataset.pageSize || '20');
    const sortDir = section.dataset.sortDir === 'desc' ? 'desc' : 'asc';
    const locale = document.documentElement.lang || 'en';
    const byLabel = section.dataset.byLabel || 'By';
    const unknownAuthorLabel = section.dataset.unknownAuthorLabel || 'Unknown';
    const loadingLabel = section.dataset.loadingLabel || 'Loading...';
    const loadMoreLabel = section.dataset.loadMoreLabel || 'Load more comments';
    const loadErrorLabel = section.dataset.loadErrorLabel || 'Unable to load more comments right now.';

    const currentCount = list.children.length;
    if (currentCount >= totalCount) {
      button.remove();
      return;
    }

    button.disabled = true;
    button.textContent = loadingLabel;
    if (error) {
      error.textContent = '';
      error.classList.add('hidden');
    }

    try {
      const url = new URL(endpoint || `/api/v1/comments/${encodeURIComponent(blockId)}`, window.location.origin);
      url.searchParams.set('limit', String(pageSize));
      url.searchParams.set('offset', String(currentCount));
      url.searchParams.set('sortDir', sortDir);

      const response = await fetch(url.toString(), {
        credentials: 'same-origin',
        headers: {
          'Accept': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to load comments: ${response.status}`);
      }

      const payload = await response.json();
      const comments = Array.isArray(payload.comments) ? payload.comments : [];

      comments.forEach((comment) => {
        list.appendChild(buildCommentItem({
          ...comment,
          authorUsername: comment.authorUsername || unknownAuthorLabel
        }, byLabel, locale));
      });

      const hasMore = Boolean(payload.hasMore);
      if (!hasMore || list.children.length >= totalCount) {
        button.remove();
      } else {
        button.disabled = false;
        button.textContent = loadMoreLabel;
      }
    } catch (err) {
      console.error(err);
      button.disabled = false;
      button.textContent = loadMoreLabel;
      if (error) {
        error.textContent = loadErrorLabel;
        error.classList.remove('hidden');
      }
    }
  }

  document.addEventListener('DOMContentLoaded', function () {
    document.querySelectorAll('[data-comments-section]').forEach((section) => {
      const button = section.querySelector('[data-comments-load-more]');
      const sortControl = section.querySelector('[data-comments-sort]');

      if (sortControl) {
        sortControl.addEventListener('change', function () {
          const url = new URL(window.location.href);
          const nextSortDir = sortControl.value === 'desc' ? 'desc' : 'asc';
          const commentsAnchorId = section.id || `comments-${section.dataset.blockId || ''}`;
          if (nextSortDir === 'asc') {
            url.searchParams.delete('commentsDir');
          } else {
            url.searchParams.set('commentsDir', nextSortDir);
          }
          if (commentsAnchorId) {
            url.hash = commentsAnchorId;
          }
          window.location.assign(url.toString());
        });
      }

      if (button) {
        button.addEventListener('click', function () {
          loadMore(section);
        });
      }
    });
  });
})();
