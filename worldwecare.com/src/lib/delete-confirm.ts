/**
 * The word somebody types to delete their own account.
 *
 * ── WHY IT IS A CONSTANT AND NOT A LITERAL IN TWO PLACES ──
 *
 * The server compares what was typed against this exact string. The
 * form tells the member what to type. Those two sentences have to
 * agree, and when the form's sentence goes through a machine
 * translator they stop agreeing — "Type DELETE to confirm" comes back
 * from Google as "Введите УДАЛИТЬ для подтверждения", the member does
 * as they are told, and the server rejects it. They are then locked
 * out of deleting their own account with an error that reads as
 * nonsense, because the instruction and the check disagree in a way
 * neither of them can show.
 *
 * So the word is never part of the translatable sentence. The
 * sentence carries a `{word}` placeholder and this fills it, which
 * means a translator can move it, wrap it, or put it in quotes, and
 * cannot replace it.
 *
 * NO IMPORTS. The route and the form both read it, one on each side
 * of the client boundary — the same rule as `i18n-core.ts`, for the
 * same reason. See the long note in `language-picker.tsx` about what
 * happened when a value crossed that line.
 *
 * IT IS DELIBERATELY ENGLISH IN EVERY LANGUAGE. A magic word that
 * changes with the locale is a magic word that stops matching when
 * somebody switches language mid-form.
 */
export const DELETE_CONFIRM_WORD = "DELETE";
