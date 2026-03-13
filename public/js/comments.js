(function () {
  function uiPath(path) {
    const uiBaseRaw = document.body?.dataset.uiBase || '';
    const uiBase = uiBaseRaw.endsWith('/') ? uiBaseRaw.slice(0, -1) : uiBaseRaw;
    return path.startsWith('/') ? `${uiBase}${path}` : `${uiBase}/${path}`;
  }

  function getTotalCount(section) {
    return Number(section.dataset.totalCount || '0');
  }

  function getLoadedCount(section) {
    return Number(section.dataset.loadedCount || section.dataset.initialCount || '0');
  }

  function getLocalTailCount(section) {
    return Number(section.dataset.localTailCount || '0');
  }

  function getRemainingServerComments(section) {
    return Math.max(0, getTotalCount(section) - getLoadedCount(section) - getLocalTailCount(section));
  }

  function setStatus(element, message, type) {
    if (!element) return;
    if (!message) {
      element.textContent = '';
      element.classList.add('hidden');
      element.removeAttribute('data-status-type');
      return;
    }

    element.textContent = message;
    element.classList.remove('hidden');
    if (type) {
      element.dataset.statusType = type;
    } else {
      element.removeAttribute('data-status-type');
    }
  }

  function updateCount(section) {
    const countEl = section.querySelector('[data-comments-count]');
    if (!countEl) return;
    const template = section.dataset.countLabelTemplate || '__COUNT__ comments';
    countEl.textContent = template.replace('__COUNT__', String(getTotalCount(section)));
  }

  function toggleEmptyState(section) {
    const empty = section.querySelector('[data-comments-empty]');
    const list = section.querySelector('[data-comments-list]');
    const hasComments = getTotalCount(section) > 0;

    empty?.classList.toggle('hidden', hasComments);
    list?.classList.toggle('hidden', !hasComments);
  }

  function updateLoadMoreState(section) {
    const button = section.querySelector('[data-comments-load-more]');
    if (!button) return;

    if (getRemainingServerComments(section) === 0) {
      button.remove();
    } else {
      button.disabled = false;
      button.textContent = section.dataset.loadMoreLabel || 'Load more comments';
    }
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

  function insertComment(section, comment, options) {
    const list = section.querySelector('[data-comments-list]');
    if (!list) return;

    const sortDir = section.dataset.sortDir === 'desc' ? 'desc' : 'asc';
    const item = buildCommentItem(comment, options.byLabel, options.locale);

    if (sortDir === 'desc') {
      list.prepend(item);
      section.dataset.loadedCount = String(getLoadedCount(section) + 1);
      return;
    }

    const hasGap = getRemainingServerComments(section) > 0;
    if (hasGap) {
      item.dataset.commentsLocalTail = 'true';
      list.appendChild(item);
      section.dataset.localTailCount = String(getLocalTailCount(section) + 1);
      return;
    }

    list.appendChild(item);
    section.dataset.loadedCount = String(getLoadedCount(section) + 1);
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

    const currentCount = getLoadedCount(section);
    if (getRemainingServerComments(section) === 0 || currentCount >= totalCount) {
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
      const insertBefore = sortDir === 'asc'
        ? list.querySelector('[data-comments-local-tail="true"]')
        : null;

      comments.forEach((comment) => {
        const item = buildCommentItem({
          ...comment,
          authorUsername: comment.authorUsername || unknownAuthorLabel
        }, byLabel, locale);

        if (insertBefore) {
          list.insertBefore(item, insertBefore);
        } else {
          list.appendChild(item);
        }
      });

      section.dataset.loadedCount = String(currentCount + comments.length);
      updateLoadMoreState(section);
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

  async function submitComment(section) {
    const form = section.querySelector('[data-comments-form]');
    const input = section.querySelector('[data-comments-input]');
    const submit = section.querySelector('[data-comments-submit]');
    const status = section.querySelector('[data-comments-form-status]');
    const list = section.querySelector('[data-comments-list]');

    if (!form || !input || !submit || !list) return;

    const body = input.value.trim();
    if (!body) {
      setStatus(status, section.dataset.submitErrorLabel || 'Unable to post your comment right now.', 'error');
      return;
    }

    const locale = document.documentElement.lang || 'en';
    const byLabel = section.dataset.byLabel || 'By';
    const unknownAuthorLabel = section.dataset.unknownAuthorLabel || 'Unknown';
    const submitLabel = section.dataset.submitLabel || 'Post comment';
    const submittingLabel = section.dataset.submittingLabel || 'Posting...';

    input.disabled = true;
    submit.disabled = true;
    submit.textContent = submittingLabel;
    setStatus(status, submittingLabel, null);

    try {
      const response = await fetch(section.dataset.apiEndpoint, {
        method: 'POST',
        credentials: 'same-origin',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ body })
      });

      const payload = await response.json().catch(() => ({}));

      if (response.status === 401) {
        window.showLoginModal?.('actions.commentOnBlock');
        throw new Error(payload?.error || 'User not authenticated');
      }

      if (!response.ok) {
        throw new Error(payload?.error || section.dataset.submitErrorLabel || 'Unable to post your comment right now.');
      }

      insertComment(section, {
        ...payload.comment,
        authorUsername: section.dataset.currentUsername || unknownAuthorLabel,
        authorProfilePath: section.dataset.currentProfilePath || null
      }, { byLabel, locale });

      section.dataset.totalCount = String(getTotalCount(section) + 1);
      updateCount(section);
      toggleEmptyState(section);
      updateLoadMoreState(section);

      input.value = '';
      setStatus(status, section.dataset.submitSuccessLabel || 'Comment posted.', 'success');
      window.showToast?.(section.dataset.submitSuccessLabel || 'Comment posted.', 'success');
    } catch (error) {
      console.error('Error submitting comment:', error);
      const message = error?.message || section.dataset.submitErrorLabel || 'Unable to post your comment right now.';
      setStatus(status, message, 'error');
      window.showToast?.(message, 'error');
    } finally {
      input.disabled = false;
      submit.disabled = false;
      submit.textContent = submitLabel;
      input.focus();
    }
  }

  document.addEventListener('DOMContentLoaded', function () {
    document.querySelectorAll('[data-comments-section]').forEach((section) => {
      const button = section.querySelector('[data-comments-load-more]');
      const sortControl = section.querySelector('[data-comments-sort]');
      const loginButton = section.querySelector('[data-comments-login]');
      const form = section.querySelector('[data-comments-form]');

      section.dataset.loadedCount = String(getLoadedCount(section));
      section.dataset.localTailCount = String(getLocalTailCount(section));
      toggleEmptyState(section);

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

      if (loginButton) {
        loginButton.addEventListener('click', function () {
          window.showLoginModal?.('actions.commentOnBlock');
        });
      }

      if (form) {
        form.addEventListener('submit', function (event) {
          event.preventDefault();
          submitComment(section);
        });
      }
    });
  });
})();
