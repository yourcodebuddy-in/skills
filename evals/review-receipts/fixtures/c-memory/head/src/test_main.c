#include <assert.h>
#include <stdlib.h>
#include <string.h>

#include "list.h"
#include "strutil.h"

int main(void) {
    char *copy = str_dup("hello");
    assert(strcmp(copy, "hello") == 0);
    free(copy);

    char *trimmed = str_trim_dup("  hello  ");
    assert(strcmp(trimmed, "hello") == 0);
    free(trimmed);

    struct node *head = NULL;
    assert(list_push(&head, 1) == 0);
    assert(list_push(&head, 2) == 0);
    assert(list_remove(&head, 1) == 1);
    assert(head->value == 2);
    list_free(head);
    return 0;
}
