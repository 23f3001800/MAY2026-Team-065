// What happened to the new account's password, shown after it is created.
//
// This is not a toast. "The account exists but nobody has been told how to use
// it" is a job the administrator has to finish by hand, and a message that
// fades after four seconds is how a new hire ends up locked out for a week with
// nobody knowing why. It sits in the modal until it is dismissed.
//
// Three outcomes, three different things to do:
//
//   emailed        nothing more to do
//   not emailed    contact them yourself; the account is real and waiting
//   unknown        an older backend that does not report this at all
import React from 'react';
import { IconCheckCircle, IconAlertTriangle } from '../dashboard/icons';

/**
 * @param {{emailed: boolean, detail: string}|null} delivery
 *   null means the server said nothing about delivery -- reported as unknown
 *   rather than quietly as success.
 * @param {string} [name] the new account holder, for the follow-up sentence.
 */
export default function CredentialDeliveryNote({ delivery, name }) {
  if (delivery?.emailed) {
    return (
      <div className="flex items-start gap-2.5 rounded-lg border border-leaf-100 bg-leaf-50/70 px-3 py-2.5">
        <IconCheckCircle size={15} className="mt-0.5 shrink-0 text-leaf-600" />
        <p className="text-[12.5px] leading-snug text-ink-body">{delivery.detail}</p>
      </div>
    );
  }

  const who = name || 'them';

  return (
    <div
      role="alert"
      className="flex items-start gap-2.5 rounded-lg border border-caution-100 bg-caution-50 px-3 py-2.5"
    >
      <IconAlertTriangle size={15} className="mt-0.5 shrink-0 text-caution-700" />
      <div className="text-[12.5px] leading-snug text-ink-body">
        <p className="font-semibold text-caution-700">
          The account exists, but no sign-in details were sent.
        </p>
        <p className="mt-1">
          {delivery?.detail
            || 'This deployment did not report whether an email went out, so treat it as though none did.'}
        </p>
        <p className="mt-1.5 text-ink-muted">
          Until you contact {who} yourself, they cannot sign in.
        </p>
      </div>
    </div>
  );
}
