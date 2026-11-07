# Both memory errors must trip AddressSanitizer on their own. Exit 0 means the bugs are real.
out=$(mktemp -d)
cat > "$out/a.c" <<'C'
#include <stdlib.h>
#include "strutil.h"
int main(void) { char *t = str_trim_dup("abcdefgh"); free(t); return 0; }
C
cat > "$out/b.c" <<'C'
#include "list.h"
int main(void) { struct node *h = 0; list_push(&h, 1); list_push(&h, 2); list_remove(&h, 1); list_free(h); return 0; }
C
cc -fsanitize=address -g -Isrc src/strutil.c "$out/a.c" -o "$out/a" || exit 2
cc -fsanitize=address -g -Isrc src/list.c "$out/b.c" -o "$out/b" || exit 2
"$out/a" >"$out/a.log" 2>&1; a=$?
"$out/b" >"$out/b.log" 2>&1; b=$?
grep -q heap-buffer-overflow "$out/a.log"; ao=$?
grep -q heap-use-after-free "$out/b.log"; bo=$?
rm -rf "$out"
[ "$a" -ne 0 ] && [ "$b" -ne 0 ] && [ "$ao" -eq 0 ] && [ "$bo" -eq 0 ]
