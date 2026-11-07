#include "strutil.h"

#include <stdlib.h>
#include <string.h>

char *str_dup(const char *s) {
    size_t len = strlen(s);
    char *out = malloc(len + 1);
    if (!out) return NULL;
    memcpy(out, s, len + 1);
    return out;
}
