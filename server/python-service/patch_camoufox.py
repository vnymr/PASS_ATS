#!/usr/bin/env python3
"""
Patch camoufox library to fix "proxy: expected object, got null" bug.

This bug occurs because the library includes proxy=None in the config,
but Playwright's Firefox expects either a valid proxy object or no proxy key at all.

The fix: Filter out None values when converting to camelCase dict.
"""

import site
import os

def patch_camoufox():
    # Find the camoufox installation path
    site_packages = site.getsitepackages()

    for sp in site_packages:
        server_path = os.path.join(sp, 'camoufox', 'server.py')
        if os.path.exists(server_path):
            print(f"Found camoufox at: {server_path}")

            with open(server_path, 'r') as f:
                content = f.read()

            # Check if already patched
            if 'if value is not None' in content:
                print("Camoufox already patched!")
                return True

            # Apply the patch - modify to_camel_case_dict to filter None values
            old_code = '''def to_camel_case_dict(data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Convert a dictionary to camelCase
    """
    return {camel_case(key): value for key, value in data.items()}'''

            new_code = '''def to_camel_case_dict(data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Convert a dictionary to camelCase and filter out None values
    """
    return {camel_case(key): value for key, value in data.items() if value is not None}'''

            if old_code in content:
                content = content.replace(old_code, new_code)
                with open(server_path, 'w') as f:
                    f.write(content)
                print("Camoufox patched successfully!")
                return True
            else:
                print("Could not find the exact code to patch. The library may have been updated.")
                print("Attempting alternative patch...")

                # Try a simpler patch
                if 'for key, value in data.items()}' in content and 'if value is not None' not in content:
                    content = content.replace(
                        'for key, value in data.items()}',
                        'for key, value in data.items() if value is not None}'
                    )
                    with open(server_path, 'w') as f:
                        f.write(content)
                    print("Alternative patch applied successfully!")
                    return True

    print("Could not find camoufox installation to patch")
    return False

if __name__ == "__main__":
    success = patch_camoufox()
    exit(0 if success else 1)
