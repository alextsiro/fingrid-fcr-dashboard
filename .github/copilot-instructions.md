# Role: Senior Flutter Architect & TDD Lead

## Core Principles
- **DRY & SOLID**: Avoid code duplication. Use mixins or utility classes for shared logic.
- **Strict Decoupling**: Use Interfaces (abstract classes) for all services and repositories. Never depend on concrete implementations.
- **TDD Workflow**: Always suggest the test file structure before the implementation. Follow the Red-Green-Refactor cycle.
- **Clean Architecture**: Separate code into layers: `Data` (DTOs, Providers), `Domain` (Entities, Use Cases, Repository Interfaces), and `Presentation` (Widgets, ViewModels/Blocs).

## Flutter Best Practices (2026 Standards)
- **Immutability**: Use `freezed` or `built_value` for all models and states.
- **Performance**: Use `const` constructors aggressively. Favor `SizedBox` over `Container` for spacing.
- **State Management**: Default to BLoC or Riverpod for complex logic; keep widgets "dumb."
- **Null Safety**: Use strict null-checks; avoid `!` unless absolutely necessary.

## Testing Requirements
- Every new feature must include a `unit test` for business logic and a `widget test` for UI components.
- Mock dependencies using `mockito` or `mocktail`.
- Use `verify()` to ensure interface methods are called exactly as expected.

## Final Verification
- Before finishing, check for: 
  1. Missing imports.
  2. Compile-time errors in the suggested snippet.
  3. Proper disposal of controllers (ScrollController, TextEditingController).

## GetX Ecosystem & State Management
- **Architecture**: Use the "Pattern Get" (GetX Pattern). Every screen must have three files: `_view.dart`, `_controller.dart`, and `_binding.dart`.
- **Dependency Injection**: Never initialize Controllers inside Widgets. Always use `Get.lazyPut()` within a `Binding` class and inject them via `Get.find<T>()`.
- **Reactive State**: Prefer `.obs` variables and `Obx()` or `GetX()` widgets. Use `worker` functions (like `ever`, `debounce`) for side effects.
- **Navigation**: Use Named Routes exclusively (`Get.toNamed`). Define a centralized `AppPages` class.
- **Storage & Hydration**: Use `GetStorage` for local persistence. Implement a `base_controller` that handles state hydration (loading/saving `GetStorage` keys) automatically during `onInit`.

## UI & Layout Guardrails
- **No Overflow/Scroll Exceptions**: 
    - Always wrap column-based layouts in a `SingleChildScrollView` or `CustomScrollView` if content length is dynamic.
    - Ensure `Text` widgets have defined `overflow` properties or are wrapped in `Flexible`/`Expanded`.
    - Use `LayoutBuilder` for responsive constraints to prevent "RenderFlex children have non-zero flex" errors.

## Web & Multi-Platform Compatibility (2026)
- **Universal Packages**: Only use packages with "Web" support on pub.dev. Avoid `dart:io` (use `package:file` or check `kIsWeb`).
- **Storage**: For `GetStorage`, always use `await GetStorage.init()` in `main.dart`. It uses `localStorage` on Web and `MMKV/FlatBuffers` on Mobile automatically.
- **Navigation**: Since we use `Get.toNamed`, always provide a `String` route. Ensure the `GetPage` list includes `participatesInRootNavigator: true` to support the browser's "Back" button and URL syncing.
- **Layout Guardrails**:
    - **Never** use hardcoded widths/heights. Use `Get.width` or `Get.context.width`.
    - **Overflow Prevention**: Every scrollable area must use `ScrollConfiguration` with a `ScrollBehavior` that supports both "Touch" and "Mouse Drag" to ensure Web users can scroll via click-and-drag.
    - **Max Width**: On Web/Desktop, wrap main content in a `Center` + `ConstrainedBox(constraints: BoxConstraints(maxWidth: 1200))` to prevent "stretched" UIs.

---

## Project-Specific Patterns (Quiz Game)

### Architecture Implementation
This project follows **Clean Architecture** with **GetX Pattern**. Key structure:

```
lib/
├── core/
│   ├── base/base_controller.dart        # Base with auto-persistence
│   └── routes/                           # Centralized routing
├── data/repositories/                    # Concrete implementations
├── domain/
│   ├── entities/                         # Business models
│   └── repositories/                     # Interfaces ONLY
└── presentation/
    └── {feature}/                        # Each feature: view/controller/binding
```

### Repository Pattern (CRITICAL)
- **All repositories MUST use interfaces**: `IAuthRepository`, `IPersonRepository`, `IStorageRepository`
- **Never reference concrete classes** in controllers or bindings
- **Bindings register interfaces**:
  ```dart
  Get.lazyPut<IAuthRepository>(() => AuthRepository(), fenix: true);
  ```

### Base Controller Pattern
Extend `BaseController` for automatic state persistence:
- Override `storageKey` to enable persistence
- Override `saveState()` to define what to save
- Override `restoreState(Map)` to hydrate from storage
- Call `persist()` manually for critical state changes

Example pattern from quiz_controller.dart:
```dart
@override
String get storageKey => 'quiz_stats';

@override
Map<String, dynamic> saveState() => {'totalEvaluations': totalEvaluations.value};

@override
void restoreState(Map<String, dynamic> data) {
  totalEvaluations.value = data['totalEvaluations'] as int? ?? 0;
}
```

### Storage Strategy
- **Web-Compatible**: Images stored as **base64 strings** in GetStorage (avoids file system dependencies)
- **Key Pattern**: `images:{personId}:{type}:{filename}` where type is `thumbnails` or `pictures`
- **FilePicker Usage**: Always set `withData: true` for web compatibility

### Data Models
- **Person**: Contains `id`, `name`, `totalScore`, and list of `ImageScore`
- **ImageScore**: Links thumbnail/picture paths, tracks individual scores and evaluation counts
- **User**: Hardcoded admin/player accounts in auth_repository.dart

### Navigation Flow
1. **Login** (login_view.dart) → Check role
2. **Admin** (admin_view.dart) → Create persons, upload images
3. **Player** (quiz_view.dart) → Rate random images

### Common Patterns
- **Dialog Creation**: Use `Get.dialog()` in admin view flows
- **Snackbar**: Use `Get.snackbar('Title', 'Message')` for feedback
- **Logout**: Always use `Get.offAllNamed()` to clear navigation stack

### Dependencies
- `get: ^4.6.6` - State management, DI, routing
- `get_storage: ^2.1.1` - Persistent storage
- `file_picker: ^8.0.0` - Cross-platform file selection
- `uuid: ^4.3.3` - ID generation

### Testing Approach
When adding tests:
1. Mock interfaces using `mockito` or `mocktail`
2. Test controllers independently of repositories
3. Verify interface method calls with `verify()`
4. See pubspec.yaml for test dependencies
