import {isArray} from 'lodash';

const _encryptTextProp = (ctx, name, key, object) => {
  if (!object[name]) {
    return Promise.resolve();
  }

  return ctx.webex.internal.encryption
    .encryptText(key.uri || key, object[name])
    .then((ciphertext) => {
      object[name] = ciphertext;
    });
};

const _encryptCalendarEventPayload = (data, ctx) => {
  Object.assign(data, {encryptionKeyUrl: ctx.encryptionKeyUrl});

  const encryptedAttendees = data.attendees
    ? data.attendees.map((attendee) =>
        Promise.all([
          _encryptTextProp(ctx, 'displayName', data.encryptionKeyUrl, attendee),
          _encryptTextProp(ctx, 'email', data.encryptionKeyUrl, attendee),
        ])
      )
    : [];

  return Promise.all(
    [
      _encryptTextProp(ctx, 'subject', data.encryptionKeyUrl, data),
      _encryptTextProp(ctx, 'notes', data.encryptionKeyUrl, data),
      _encryptTextProp(ctx, 'webexOptions', data.encryptionKeyUrl, data),
    ].concat([encryptedAttendees])
  );
};

const _encryptFreeBusyPayload = (data, ctx) => {
  Object.assign(data, {encryptionKeyUrl: ctx.encryptionKeyUrl});

  const promises = [];
  if (data.emails && Array.isArray(data.emails)) {
    data.emails.map((item, index) =>
      promises.push(
        ctx.webex.internal.encryption
          .encryptText(data.encryptionKeyUrl, item)
          .then((encryptText) => {
            data.emails[index] = encryptText;
          })
      )
    );
  }

  return Promise.all(promises);
};

const EncryptHelper = {
  /**
   * Encrypt create / update calendar event request payload
   * @param {object} [ctx] context
   * @param {object} [data] meeting payload data
   * @returns {Promise} Resolves with encrypted request payload
   * */
  encryptCalendarEventRequest: (ctx, data) => {
    if (ctx.encryptionKeyUrl) {
      return _encryptCalendarEventPayload(data, ctx);
    }

    return ctx.webex.internal.encryption.kms.createUnboundKeys({count: 1}).then((keys) => {
      const key = isArray(keys) ? keys[0] : keys;
      ctx.encryptionKeyUrl = key.uri;

      return _encryptCalendarEventPayload(data, ctx);
    });
  },
  /**
   * Encrypt free-busy request payload
   * @param {object} [ctx] context
   * @param {object} [data] free busy payload data
   * @returns {Promise} Resolves with encrypted request payload
   * */
  encryptFreeBusyRequest: (ctx, data) => {
    if (ctx.encryptionKeyUrl) {
      return _encryptFreeBusyPayload(data, ctx);
    }

    return ctx.webex.internal.encryption.kms.createUnboundKeys({count: 1}).then((keys) => {
      const key = isArray(keys) ? keys[0] : keys;
      ctx.encryptionKeyUrl = key.uri;

      return _encryptFreeBusyPayload(data, ctx);
    });
  },
};

export default EncryptHelper;
