grep -q "static bool button_pressed" fw/main.c && ! grep -q volatile fw/main.c && cc -c -Ifw fw/main.c -o /dev/null
