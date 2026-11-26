#!/usr/bin/perl -w
# One-shot: replace hard-coded Tailwind palette classes with design tokens.
# Ordered longest-first inside each family so /opacity variants and
# hover:/focus: prefixes are matched before the bare class.
use strict;

my @MAP = (
  # ── scrims over media: black is correct in BOTH modes ──────────
  [ qr/\bbg-slate-900\/(\d+)\b/,        'bg-black/$1' ],
  [ qr/\bhover:bg-slate-900\b/,         'hover:bg-black' ],

  # ── inverse surface: toasts and the anonymous avatar ───────────
  [ qr/\bbg-slate-900 text-white\b/,    'bg-[color:var(--color-text)] text-[color:var(--color-surface)]' ],
  [ qr/\bbg-slate-800 text-slate-200\b/,'bg-[color:var(--color-text)] text-[color:var(--color-surface)]' ],

  # ── neutrals ───────────────────────────────────────────────────
  [ qr/\bhover:bg-slate-300\b/,         'hover:bg-[color:var(--color-text-subtle)]' ],
  [ qr/\bbg-slate-100\b/,               'bg-[color:var(--color-surface-hover)]' ],
  [ qr/\bbg-slate-200\b/,               'bg-[color:var(--color-border-strong)]' ],
  [ qr/\bbg-slate-300\b/,               'bg-[color:var(--color-border-strong)]' ],
  [ qr/\bbg-slate-400\b/,               'bg-[color:var(--color-text-subtle)]' ],
  [ qr/\btext-slate-600\b/,             'text-[color:var(--color-text-muted)]' ],
  [ qr/\btext-slate-500\b/,             'text-[color:var(--color-text-subtle)]' ],
  [ qr/\btext-slate-400\b/,             'text-[color:var(--color-text-subtle)]' ],

  # ── warning (amber) ────────────────────────────────────────────
  [ qr/\bhover:bg-amber-100\b/,         'hover:bg-[color:var(--color-warning-soft)]' ],
  [ qr/\bhover:bg-amber-700\b/,         'hover:bg-[color:var(--color-warning-ink)]' ],
  [ qr/\bbg-amber-(?:400|500)\/(\d+)\b/,'bg-[color:var(--color-warning)]/$1' ],
  [ qr/\bbg-amber-50\/(\d+)\b/,         'bg-[color:var(--color-warning-soft)]/$1' ],
  [ qr/\bbg-amber-(?:50|100)\b/,        'bg-[color:var(--color-warning-soft)]' ],
  [ qr/\bbg-amber-(?:500|600)\b/,       'bg-[color:var(--color-warning)]' ],
  [ qr/\btext-amber-(?:700|800|900)\/(\d+)\b/, 'text-[color:var(--color-warning-ink)]/$1' ],
  [ qr/\btext-amber-(?:700|800|900)\b/, 'text-[color:var(--color-warning-ink)]' ],
  [ qr/\btext-amber-600\b/,             'text-[color:var(--color-warning)]' ],
  [ qr/\bborder-amber-300\b/,           'border-[color:var(--color-warning)]/40' ],
  [ qr/\bborder-amber-(?:100|200)\b/,   'border-[color:var(--color-warning-soft)]' ],

  # ── success (emerald) ──────────────────────────────────────────
  [ qr/\bbg-emerald-(?:50|100)\b/,      'bg-[color:var(--color-success-soft)]' ],
  [ qr/\bbg-emerald-(?:400|500|600)\b/, 'bg-[color:var(--color-success)]' ],
  [ qr/\btext-emerald-(?:700|800)\b/,   'text-[color:var(--color-success-ink)]' ],
  [ qr/\btext-emerald-600\b/,           'text-[color:var(--color-success)]' ],
  [ qr/\bborder-emerald-(?:100|200)\b/, 'border-[color:var(--color-success-soft)]' ],

  # ── danger (red + rose) ────────────────────────────────────────
  [ qr/\bhover:bg-(?:red|rose)-50\b/,   'hover:bg-[color:var(--color-danger-soft)]' ],
  [ qr/\bhover:bg-(?:red|rose)-(?:600|700)\b/, 'hover:bg-[color:var(--color-danger-ink)]' ],
  [ qr/\bfocus:ring-(?:red|rose)-100\b/,'focus:ring-[color:var(--color-danger-soft)]' ],
  [ qr/\bring-(?:red|rose)-100\b/,      'ring-[color:var(--color-danger-soft)]' ],
  [ qr/\bbg-(?:red|rose)-(?:50|100)\b/, 'bg-[color:var(--color-danger-soft)]' ],
  [ qr/\bbg-(?:red|rose)-(?:500|600)\b/,'bg-[color:var(--color-danger)]' ],
  [ qr/\btext-(?:red|rose)-(?:700|800)\/(\d+)\b/, 'text-[color:var(--color-danger-ink)]/$1' ],
  [ qr/\btext-(?:red|rose)-(?:700|800)\b/, 'text-[color:var(--color-danger-ink)]' ],
  [ qr/\btext-(?:red|rose)-600\b/,      'text-[color:var(--color-danger)]' ],
  [ qr/\bborder-(?:red|rose)-(?:100|200)\b/, 'border-[color:var(--color-danger-soft)]' ],

  # ── confessions' indigo: keep the night banner, token the rest ─
  [ qr/\bfocus:ring-indigo-400\/(\d+)\b/, 'focus:ring-[color:var(--color-brand)]/$1' ],
  [ qr/\bfocus:border-indigo-400\b/,    'focus:border-[color:var(--color-brand)]' ],
  [ qr/\bbg-indigo-100 text-indigo-700\b/, 'bg-[color:var(--color-brand-soft)] text-[color:var(--color-brand-ink)]' ],
  [ qr/\b!bg-indigo-600 hover:!bg-indigo-500\b/, '!bg-[color:var(--color-brand)] hover:!bg-[color:var(--color-brand-hover)]' ],
  [ qr/\bborder-l-indigo-300\b/,        'border-l-[color:var(--color-brand)]/40' ],
  [ qr/\bborder-indigo-100\b/,          'border-[color:var(--color-border)]' ],
  [ qr/\bbg-violet-50\b/,               'bg-[color:var(--color-accent-soft)]' ],
  [ qr/\btext-violet-700\b/,            'text-[color:var(--color-accent-ink)]' ],
);

my $total = 0;
for my $file (@ARGV) {
  open my $fh, '<', $file or die "$file: $!";
  local $/; my $src = <$fh>; close $fh;
  my $orig = $src;
  my $n = 0;
  for my $rule (@MAP) {
    my ($re, $to) = @$rule;
    $n += ($src =~ s{$re}{ my $r = $to; my $c = defined($1) ? $1 : q{}; $r =~ s/\$1/$c/g; $r }ge);
  }
  next if $src eq $orig;
  open my $out, '>', $file or die "$file: $!";
  print $out $src; close $out;
  printf "%4d  %s\n", $n, $file;
  $total += $n;
}
print "----\n$total replacements\n";
