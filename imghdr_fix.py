# Обходной путь для Python 3.13
import sys
if sys.version_info >= (3, 13):
    import warnings
    warnings.filterwarnings("ignore", category=DeprecationWarning)
    
    # Эмуляция imghdr
    class FakeImghdr:
        def what(self, *args, **kwargs):
            return None
    
    sys.modules['imghdr'] = FakeImghdr()
