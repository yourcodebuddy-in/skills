#include <assert.h>
#include <stdlib.h>
#include <string.h>

#include "list.h"
#include "strutil.h"

int main(void) {
    char *copy = str_dup("hello");
    assert(strcmp(copy, "hello") == 0);
    free(copy);

    struct node *head = NULL;
    assert(list_push(&head, 1) == 0);
    assert(head->value == 1);
    list_free(head);
    return 0;
}
