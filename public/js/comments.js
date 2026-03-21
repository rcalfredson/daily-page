(function () {
  function uiPath(path) {
    const uiBaseRaw = document.body?.dataset.uiBase || '';
    const uiBase = uiBaseRaw.endsWith('/') ? uiBaseRaw.slice(0, -1) : uiBaseRaw;
    return path.startsWith('/') ? `${uiBase}${path}` : `${uiBase}/${path}`;
  }

  function getTotalCount(section) {
    return Number(section.dataset.totalCount || '0');
  }

  function getThreadTotalCount(section) {
    return Number(section.dataset.threadTotalCount || section.dataset.totalCount || '0');
  }

  function getLoadedCount(section) {
    return Number(section.dataset.loadedCount || section.dataset.initialCount || '0');
  }

  function getLocalTailCount(section) {
    return Number(section.dataset.localTailCount || '0');
  }

  function getRemainingServerComments(section) {
    return Math.max(0, getThreadTotalCount(section) - getLoadedCount(section) - getLocalTailCount(section));
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

  function getReportState(section) {
    const raw = section.dataset.reportedCommentIds;
    if (raw) {
      return new Set(raw.split(',').map((id) => id.trim()).filter(Boolean));
    }
    return new Set();
  }

  function setReportState(section, reportedIds) {
    section.dataset.reportedCommentIds = Array.from(reportedIds).join(',');
  }

  function markCommentReported(section, button, label) {
    if (!button) return;
    const commentId = button.dataset.commentId;
    if (commentId) {
      const reportedIds = getReportState(section);
      reportedIds.add(commentId);
      setReportState(section, reportedIds);
    }

    button.disabled = true;
    button.classList.add('is-reported');
    button.dataset.reported = 'true';
    button.textContent = label || section.dataset.reportReportedLabel || 'Reported';
    button.setAttribute('aria-disabled', 'true');
  }

  function escapeSelector(value) {
    if (window.CSS?.escape) return window.CSS.escape(String(value));
    return String(value).replace(/["\\]/g, '\\$&');
  }

  function findCommentArticle(section, commentId) {
    if (!commentId) return null;
    return section.querySelector(`[data-comment-id="${escapeSelector(commentId)}"]`);
  }

  function getThreadItemForComment(article) {
    return article?.closest('.comments-list__item');
  }

  function getReplyItemForComment(article) {
    return article?.closest('.comments-list__reply-item');
  }

  function getReplyCountForThread(threadItem) {
    if (!threadItem) return 0;
    return threadItem.querySelectorAll('.comments-list__reply-item').length;
  }

  function removeComment(section, article) {
    const replyItem = getReplyItemForComment(article);
    if (replyItem) {
      replyItem.remove();
      section.dataset.totalCount = String(Math.max(0, getTotalCount(section) - 1));
      updateCount(section);
      toggleEmptyState(section);

      const repliesList = article.closest('.comments-list__replies');
      if (repliesList && !repliesList.children.length) {
        repliesList.remove();
      }
      return;
    }

    const threadItem = getThreadItemForComment(article);
    if (!threadItem) return;

    const wasLocalTail = threadItem.dataset.commentsLocalTail === 'true';
    const replyCount = getReplyCountForThread(threadItem);
    threadItem.remove();

    if (wasLocalTail) {
      section.dataset.localTailCount = String(Math.max(0, getLocalTailCount(section) - 1));
    } else {
      section.dataset.loadedCount = String(Math.max(0, getLoadedCount(section) - 1));
    }

    section.dataset.threadTotalCount = String(Math.max(0, getThreadTotalCount(section) - 1));
    section.dataset.totalCount = String(Math.max(0, getTotalCount(section) - 1 - replyCount));
    updateCount(section);
    toggleEmptyState(section);
    updateLoadMoreState(section);
  }

  function buildReplyForm(parentCommentId, options) {
    const form = document.createElement('form');
    form.className = 'comment-reply-form hidden';
    form.dataset.commentReplyForm = 'true';
    form.dataset.parentCommentId = parentCommentId;

    const label = document.createElement('label');
    label.className = 'sr-only';
    label.htmlFor = `reply-body-${parentCommentId}`;
    label.textContent = options.replyLabel || 'Reply';

    const input = document.createElement('textarea');
    input.className = 'comment-reply-form__input';
    input.id = `reply-body-${parentCommentId}`;
    input.name = 'body';
    input.rows = 3;
    input.maxLength = 1500;
    input.required = true;
    input.placeholder = options.replyPlaceholder || 'Write a reply...';
    input.dataset.commentReplyInput = 'true';

    const actions = document.createElement('div');
    actions.className = 'comment-reply-form__actions';

    const submit = document.createElement('button');
    submit.type = 'submit';
    submit.className = 'comment-reply-form__submit';
    submit.dataset.commentReplySubmit = 'true';
    submit.textContent = options.replySubmitLabel || 'Post reply';

    const cancel = document.createElement('button');
    cancel.type = 'button';
    cancel.className = 'comment-reply-form__cancel';
    cancel.dataset.commentReplyCancel = 'true';
    cancel.textContent = options.replyCancelLabel || 'Cancel';

    const status = document.createElement('p');
    status.className = 'comment-reply-form__status hidden';
    status.setAttribute('role', 'status');
    status.setAttribute('aria-live', 'polite');
    status.dataset.commentReplyStatus = 'true';

    actions.appendChild(submit);
    actions.appendChild(cancel);
    form.appendChild(label);
    form.appendChild(input);
    form.appendChild(actions);
    form.appendChild(status);

    return form;
  }

  function buildCommentArticle(comment, options, isReply) {
    const byLabel = options.byLabel || 'By';
    const locale = options.locale || 'en';

    const article = document.createElement('article');
    article.className = `comment${isReply ? ' comment--reply' : ''}`;
    if (comment._id) {
      article.dataset.commentId = comment._id;
      article.id = `comment-${comment._id}`;
    }
    article.dataset.parentCommentId = comment.parentCommentId || '';

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

    const metaActions = document.createElement('div');
    metaActions.className = 'comment__meta-actions';
    metaActions.appendChild(time);

    if (!isReply) {
      const replyButton = document.createElement('button');
      replyButton.type = 'button';
      replyButton.className = 'comment__reply-button';
      replyButton.dataset.commentReply = 'true';
      replyButton.dataset.commentId = comment._id;
      replyButton.textContent = options.replyButtonLabel || 'Reply';
      metaActions.appendChild(replyButton);
    }

    const reportButton = document.createElement('button');
    reportButton.type = 'button';
    reportButton.className = 'comment__report-button';
    reportButton.dataset.commentReport = 'true';
    if (comment._id) {
      reportButton.dataset.commentId = comment._id;
    }
    reportButton.textContent = options.reportLabel || 'Report';
    metaActions.appendChild(reportButton);

    header.appendChild(author);
    header.appendChild(metaActions);

    const body = document.createElement('div');
    body.className = 'comment__body';

    const paragraph = document.createElement('p');
    paragraph.textContent = comment.body || '';
    body.appendChild(paragraph);

    article.appendChild(header);
    article.appendChild(body);

    if (!isReply && options.canReply && comment._id) {
      article.appendChild(buildReplyForm(comment._id, options));
    }

    if (comment._id && options.reportedIds?.has(comment._id)) {
      markCommentReported(options.section, reportButton, options.reportedLabel);
    }

    return article;
  }

  function buildReplyItem(reply, options) {
    const item = document.createElement('li');
    item.className = 'comments-list__reply-item';
    item.appendChild(buildCommentArticle(reply, options, true));
    return item;
  }

  function buildThreadItem(comment, options) {
    const item = document.createElement('li');
    item.className = 'comments-list__item';
    item.appendChild(buildCommentArticle(comment, options, false));

    if (Array.isArray(comment.replies) && comment.replies.length) {
      const repliesList = document.createElement('ol');
      repliesList.className = 'comments-list__replies';
      comment.replies.forEach((reply) => {
        repliesList.appendChild(buildReplyItem(reply, options));
      });
      item.appendChild(repliesList);
    }

    return item;
  }

  function ensureRepliesList(threadItem) {
    let repliesList = threadItem.querySelector('.comments-list__replies');
    if (!repliesList) {
      repliesList = document.createElement('ol');
      repliesList.className = 'comments-list__replies';
      threadItem.appendChild(repliesList);
    }
    return repliesList;
  }

  function insertReplyComment(section, comment, options) {
    const parentArticle = findCommentArticle(section, comment.parentCommentId);
    const threadItem = getThreadItemForComment(parentArticle);
    if (!parentArticle || !threadItem) return false;

    const repliesList = ensureRepliesList(threadItem);
    const replyItem = buildReplyItem(comment, options);
    const sortDir = section.dataset.sortDir === 'desc' ? 'desc' : 'asc';

    if (sortDir === 'desc') {
      repliesList.prepend(replyItem);
    } else {
      repliesList.appendChild(replyItem);
    }

    return true;
  }

  function insertTopLevelComment(section, comment, options) {
    const list = section.querySelector('[data-comments-list]');
    if (!list) return;

    const sortDir = section.dataset.sortDir === 'desc' ? 'desc' : 'asc';
    const item = buildThreadItem(comment, options);

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

  function insertComment(section, comment, options) {
    if (comment.parentCommentId) {
      if (!insertReplyComment(section, comment, options)) {
        return;
      }
      section.dataset.totalCount = String(getTotalCount(section) + 1);
      updateCount(section);
      toggleEmptyState(section);
      return;
    }

    insertTopLevelComment(section, comment, options);
    section.dataset.totalCount = String(getTotalCount(section) + 1);
    section.dataset.threadTotalCount = String(getThreadTotalCount(section) + 1);
    updateCount(section);
    toggleEmptyState(section);
    updateLoadMoreState(section);
  }

  function closeReplyForm(form) {
    if (!form) return;
    const input = form.querySelector('[data-comment-reply-input]');
    const status = form.querySelector('[data-comment-reply-status]');

    form.classList.add('hidden');
    form.reset();
    setStatus(status, '', null);
    input?.blur();
  }

  function closeAllReplyForms(section) {
    section.querySelectorAll('[data-comment-reply-form]').forEach((form) => {
      closeReplyForm(form);
    });
  }

  function buildRenderOptions(section) {
    const locale = document.documentElement.lang || 'en';
    return {
      byLabel: section.dataset.byLabel || 'By',
      locale,
      reportLabel: section.dataset.reportLabel || 'Report',
      reportedLabel: section.dataset.reportReportedLabel || 'Reported',
      reportedIds: getReportState(section),
      replyButtonLabel: section.dataset.replyLabel || 'Reply',
      replyLabel: section.dataset.replyLabel || 'Reply',
      replyPlaceholder: section.dataset.replyPlaceholder || 'Write a reply...',
      replySubmitLabel: section.dataset.replySubmitLabel || 'Post reply',
      replyCancelLabel: section.dataset.replyCancelLabel || 'Cancel',
      canReply: section.dataset.canReply === 'true',
      section
    };
  }

  async function loadMore(section) {
    const button = section.querySelector('[data-comments-load-more]');
    const list = section.querySelector('[data-comments-list]');
    const error = section.querySelector('[data-comments-load-error]');

    if (!button || !list) return;

    const blockId = section.dataset.blockId;
    const endpoint = section.dataset.apiEndpoint;
    const threadTotal = getThreadTotalCount(section);
    const pageSize = Number(section.dataset.pageSize || '20');
    const sortDir = section.dataset.sortDir === 'desc' ? 'desc' : 'asc';
    const loadingLabel = section.dataset.loadingLabel || 'Loading...';
    const loadMoreLabel = section.dataset.loadMoreLabel || 'Load more comments';
    const loadErrorLabel = section.dataset.loadErrorLabel || 'Unable to load more comments right now.';
    const options = buildRenderOptions(section);

    const currentCount = getLoadedCount(section);
    if (getRemainingServerComments(section) === 0 || currentCount >= threadTotal) {
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
          Accept: 'application/json'
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
        const item = buildThreadItem(comment, {
          ...options,
          reportedIds: getReportState(section)
        });

        if (insertBefore) {
          list.insertBefore(item, insertBefore);
        } else {
          list.appendChild(item);
        }
      });

      section.dataset.loadedCount = String(currentCount + comments.length);
      if (typeof payload.topLevelTotal === 'number') {
        section.dataset.threadTotalCount = String(payload.topLevelTotal);
      }
      if (typeof payload.total === 'number') {
        section.dataset.totalCount = String(payload.total);
        updateCount(section);
      }
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

  async function submitComment(section, options = {}) {
    const {
      form,
      input,
      submit,
      status,
      parentCommentId = null,
      successMessage,
      errorMessage,
      submittingMessage,
      submitLabel
    } = options;

    if (!form || !input || !submit) return;

    const body = input.value.trim();
    if (!body) {
      setStatus(status, errorMessage || section.dataset.submitErrorLabel || 'Unable to post your comment right now.', 'error');
      return;
    }

    input.disabled = true;
    submit.disabled = true;
    submit.textContent = submittingMessage || section.dataset.submittingLabel || 'Posting...';
    setStatus(status, submittingMessage || section.dataset.submittingLabel || 'Posting...', null);

    try {
      const response = await fetch(section.dataset.apiEndpoint, {
        method: 'POST',
        credentials: 'same-origin',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ body, parentCommentId })
      });

      const payload = await response.json().catch(() => ({}));

      if (response.status === 401) {
        window.showLoginModal?.('actions.commentOnBlock');
        return;
      }

      if (!response.ok) {
        throw new Error(payload?.error || errorMessage || section.dataset.submitErrorLabel || 'Unable to post your comment right now.');
      }

      insertComment(section, {
        ...payload.comment,
        authorUsername: section.dataset.currentUsername || section.dataset.unknownAuthorLabel || 'Unknown',
        authorProfilePath: section.dataset.currentProfilePath || null,
        replies: []
      }, buildRenderOptions(section));

      form.reset();
      setStatus(status, successMessage || section.dataset.submitSuccessLabel || 'Comment posted.', 'success');
      window.showToast?.(successMessage || section.dataset.submitSuccessLabel || 'Comment posted.', 'success');
    } catch (error) {
      console.error('Error submitting comment:', error);
      const message = error?.message || errorMessage || section.dataset.submitErrorLabel || 'Unable to post your comment right now.';
      setStatus(status, message, 'error');
      window.showToast?.(message, 'error');
    } finally {
      input.disabled = false;
      submit.disabled = false;
      submit.textContent = submitLabel || section.dataset.submitLabel || 'Post comment';
      input.focus();
    }
  }

  async function submitTopLevelComment(section) {
    const form = section.querySelector('[data-comments-form]');
    const input = section.querySelector('[data-comments-input]');
    const submit = section.querySelector('[data-comments-submit]');
    const status = section.querySelector('[data-comments-form-status]');
    if (!form || !input || !submit) return;

    await submitComment(section, {
      form,
      input,
      submit,
      status,
      parentCommentId: null,
      successMessage: section.dataset.submitSuccessLabel || 'Comment posted.',
      errorMessage: section.dataset.submitErrorLabel || 'Unable to post your comment right now.',
      submittingMessage: section.dataset.submittingLabel || 'Posting...',
      submitLabel: section.dataset.submitLabel || 'Post comment'
    });
  }

  async function submitReply(section, form) {
    const input = form.querySelector('[data-comment-reply-input]');
    const submit = form.querySelector('[data-comment-reply-submit]');
    const status = form.querySelector('[data-comment-reply-status]');
    const parentCommentId = form.dataset.parentCommentId || null;
    if (!input || !submit || !parentCommentId) return;

    await submitComment(section, {
      form,
      input,
      submit,
      status,
      parentCommentId,
      successMessage: section.dataset.replySuccessLabel || 'Reply posted.',
      errorMessage: section.dataset.replyErrorLabel || 'Unable to post your reply right now.',
      submittingMessage: section.dataset.replySubmittingLabel || 'Posting...',
      submitLabel: section.dataset.replySubmitLabel || 'Post reply'
    });

    if (!status?.dataset?.statusType || status.dataset.statusType !== 'success') {
      return;
    }

    closeReplyForm(form);
  }

  function handleReplyAction(section, button) {
    const isLoggedIn = document.body?.dataset?.isLoggedIn === 'true';
    const canReply = section.dataset.canReply === 'true';

    if (!isLoggedIn) {
      window.showLoginModal?.('actions.commentOnBlock');
      return;
    }

    if (!canReply) {
      const message = section.dataset.verifyPromptLabel || 'Verify your email before posting a comment.';
      window.showToast?.(message, 'error');
      return;
    }

    const article = button.closest('.comment');
    const form = article?.querySelector('[data-comment-reply-form]');
    const input = form?.querySelector('[data-comment-reply-input]');
    if (!article || !form || !input) return;

    const isHidden = form.classList.contains('hidden');
    closeAllReplyForms(section);

    if (isHidden) {
      form.classList.remove('hidden');
      input.focus();
    }
  }

  async function reportComment(section, button) {
    if (!button || button.disabled || button.dataset.reported === 'true') return;

    if (document.body?.dataset?.isLoggedIn !== 'true') {
      window.showLoginModal?.('actions.reportComment');
      return;
    }

    const commentId = button.dataset.commentId || button.closest('.comment')?.dataset.commentId;
    const article = button.closest('.comment');
    if (!commentId || !article) return;

    const reportLabel = section.dataset.reportLabel || 'Report';
    const reportingLabel = section.dataset.reportingLabel || 'Reporting...';
    const successLabel = section.dataset.reportSuccessLabel || 'Comment reported.';
    const hiddenLabel = section.dataset.reportHiddenLabel || 'Comment hidden after report.';
    const errorLabel = section.dataset.reportErrorLabel || 'Unable to report this comment right now.';
    const ownErrorLabel = section.dataset.reportOwnErrorLabel || 'You cannot report your own comment.';
    const reportedLabel = section.dataset.reportReportedLabel || 'Reported';

    button.disabled = true;
    button.setAttribute('aria-busy', 'true');
    button.textContent = reportingLabel;

    try {
      const response = await fetch(uiPath(`/api/v1/comments/${encodeURIComponent(commentId)}/report`), {
        method: 'POST',
        credentials: 'same-origin',
        headers: {
          Accept: 'application/json'
        }
      });

      const payload = await response.json().catch(() => ({}));

      if (response.status === 401) {
        window.showLoginModal?.('actions.reportComment');
        button.disabled = false;
        button.removeAttribute('aria-busy');
        button.textContent = reportLabel;
        return;
      }

      if (!response.ok) {
        const serverMessage = payload?.error || errorLabel;
        if (response.status === 400 && /own comment/i.test(serverMessage)) {
          throw new Error(ownErrorLabel);
        }
        throw new Error(serverMessage);
      }

      markCommentReported(section, button, reportedLabel);

      if (payload?.hidden) {
        removeComment(section, article);
        window.showToast?.(hiddenLabel, 'success');
        return;
      }

      window.showToast?.(successLabel, 'success');
    } catch (error) {
      console.error('Error reporting comment:', error);
      button.disabled = false;
      button.removeAttribute('aria-busy');
      button.textContent = reportLabel;
      window.showToast?.(error?.message || errorLabel, 'error');
      return;
    }

    button.removeAttribute('aria-busy');
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
          submitTopLevelComment(section);
        });
      }

      section.addEventListener('click', function (event) {
        const replyButton = event.target.closest('[data-comment-reply]');
        if (replyButton && section.contains(replyButton)) {
          handleReplyAction(section, replyButton);
          return;
        }

        const cancelButton = event.target.closest('[data-comment-reply-cancel]');
        if (cancelButton && section.contains(cancelButton)) {
          closeReplyForm(cancelButton.closest('[data-comment-reply-form]'));
          return;
        }

        const reportButton = event.target.closest('[data-comment-report]');
        if (reportButton && section.contains(reportButton)) {
          reportComment(section, reportButton);
        }
      });

      section.addEventListener('submit', function (event) {
        const replyForm = event.target.closest('[data-comment-reply-form]');
        if (!replyForm || !section.contains(replyForm)) return;
        event.preventDefault();
        submitReply(section, replyForm);
      });
    });
  });
})();
