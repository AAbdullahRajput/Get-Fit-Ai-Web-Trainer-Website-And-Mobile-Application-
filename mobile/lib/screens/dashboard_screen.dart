import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:image_picker/image_picker.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../core/theme.dart';
import '../core/services/supabase_service.dart';
import '../data/models/trainer.dart';
import '../data/models/slot.dart';
import '../data/models/client.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import '../core/services/notification_service.dart';
import 'auth_screen.dart';

class DashboardScreen extends StatefulWidget {
  const DashboardScreen({super.key});

  @override
  State<DashboardScreen> createState() => _DashboardScreenState();
}

class _DashboardScreenState extends State<DashboardScreen> {
  final SupabaseService _supabaseService = SupabaseService();
  int _currentIndex = 0;
  bool _isLightBg = false;
  final List<int> _navigationHistory = [0];

  Trainer? _trainer;
  bool _isLoadingTrainer = true;
  String? _historyFilterEmail;
  String? _historyFilterName;
  RealtimeChannel? _appointmentsChannel;
  final NotificationService _notificationService = NotificationService();

  @override
  void initState() {
    super.initState();
    _notificationService.init();
    _loadTrainerData();
  }

  Future<void> _loadTrainerData() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final isLight = prefs.getBool('is_light_theme') ?? false;
      setState(() {
        _isLightBg = isLight;
      });

      final trainerString = prefs.getString('trainer');
      if (trainerString != null) {
        setState(() {
          _trainer = Trainer.fromJson(jsonDecode(trainerString));
          _isLoadingTrainer = false;
        });
        _initRealtimeNotifications();
      }

      // Refresh trainer profile from Supabase
      if (_supabaseService.currentUser != null) {
        final refreshed = await _supabaseService.fetchOrCreateTrainerProfile(
          _supabaseService.currentUser!,
        );
        setState(() {
          _trainer = refreshed;
          _isLoadingTrainer = false;
        });
        await prefs.setString('trainer', jsonEncode(refreshed.toJson()));
        _initRealtimeNotifications();
      }
    } catch (e) {
      debugPrint('Error loading trainer data: $e');
      if (mounted) {
        setState(() => _isLoadingTrainer = false);
      }
    }
  }

  void _onTabChanged(int index) {
    if (_currentIndex == index) return;
    setState(() {
      _currentIndex = index;
      _navigationHistory.remove(index);
      _navigationHistory.add(index);
    });
  }

  Future<bool> _showExitDialog() async {
    return await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: AppColors.nearBlack,
        title: const Text(
          'Exit App',
          style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold),
        ),
        content: const Text(
          'Are you sure you want to exit the application?',
          style: TextStyle(color: Colors.white70),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(false),
            child: const Text('Cancel', style: TextStyle(color: Colors.white70)),
          ),
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(true),
            child: const Text('Exit', style: TextStyle(color: AppColors.lime)),
          ),
        ],
      ),
    ) ?? false;
  }

  @override
  void dispose() {
    _cleanupRealtime();
    super.dispose();
  }

  void _cleanupRealtime() {
    if (_appointmentsChannel != null) {
      _supabaseService.client.removeChannel(_appointmentsChannel!);
      _appointmentsChannel = null;
      debugPrint('[Realtime] Unsubscribed from trainer_appointments');
    }
  }

  void _initRealtimeNotifications() {
    if (_trainer == null) return;
    
    // Cleanup any existing subscription
    _cleanupRealtime();

    final String trainerId = _trainer!.id;
    debugPrint('[Realtime] Initializing subscription for trainer: $trainerId');

    // Request permissions on startup
    _notificationService.requestPermissions();

    // Subscribe to all insertions on the trainer_appointments table
    _appointmentsChannel = _supabaseService.client.channel('public:trainer_appointments');
    _appointmentsChannel!.onPostgresChanges(
      event: PostgresChangeEvent.insert,
      schema: 'public',
      table: 'trainer_appointments',
      callback: (payload) {
        debugPrint('[Realtime] New appointment payload received: ${payload.toString()}');
        try {
          final record = payload.newRecord;
          final String? recordTrainerId = record['trainer_id']?.toString();
          
          if (recordTrainerId == null || recordTrainerId.toLowerCase() != trainerId.toLowerCase()) {
            debugPrint('[Realtime] Mismatch: record trainer ID ($recordTrainerId) does not match logged-in trainer ($trainerId)');
            return;
          }
          
          final String clientName = record['user_name']?.toString() ?? 'A client';
          final String date = record['appointment_date']?.toString() ?? '';
          final String time = record['start_time']?.toString() ?? '';
          
          _notificationService.showNotification(
            title: 'New Session Booked! 📅',
            body: '$clientName has booked a session for $date at $time.',
          );
        } catch (e) {
          debugPrint('[Realtime] Error processing payload: $e');
        }
      },
    ).subscribe((status, [error]) {
      debugPrint('[Realtime] Subscription status: $status');
      if (error != null) {
        debugPrint('[Realtime] Subscription error: ${error.toString()}');
      }
    });
  }

  void _logout() async {
    final confirm = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: AppColors.nearBlack,
        title: const Text(
          'Confirm Logout',
          style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold),
        ),
        content: const Text(
          'Are you sure you want to log out?',
          style: TextStyle(color: Colors.white70),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(false),
            child: const Text(
              'Cancel',
              style: TextStyle(color: Colors.white70),
            ),
          ),
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(true),
            child: const Text(
              'Log Out',
              style: TextStyle(color: AppColors.lime),
            ),
          ),
        ],
      ),
    );

    if (confirm == true) {
      _cleanupRealtime();
      await _supabaseService.signOut();
      final prefs = await SharedPreferences.getInstance();
      await prefs.remove('trainer');
      await prefs.remove('session');
      if (mounted) {
        Navigator.of(context).pushAndRemoveUntil(
          MaterialPageRoute(builder: (_) => const AuthScreen(isLogin: true)),
          (route) => false,
        );
      }
    }
  }

  String _formatTime(String timeStr) {
    if (timeStr.isEmpty) return '';
    final parts = timeStr.split(':');
    final hour = int.tryParse(parts[0]) ?? 0;
    final ampm = hour >= 12 ? 'PM' : 'AM';
    final displayHour = hour % 12 == 0 ? 12 : hour % 12;
    return '$displayHour:${parts[1]} $ampm';
  }

  @override
  Widget build(BuildContext context) {
    if (_isLoadingTrainer) {
      return const Scaffold(
        body: Center(child: CircularProgressIndicator(color: AppColors.lime)),
      );
    }

    if (_trainer == null) {
      return const AuthScreen(isLogin: true);
    }

    final List<Widget> tabs = [
      _HomeTab(
        trainer: _trainer!,
        formatTime: _formatTime,
        onEditProfileClicked: () => _onTabChanged(4),
        isLightTheme: _isLightBg,
        onToggleTheme: () async {
          final nextLight = !_isLightBg;
          setState(() {
            _isLightBg = nextLight;
          });
          final prefs = await SharedPreferences.getInstance();
          await prefs.setBool('is_light_theme', nextLight);
        },
        onSessionsTabClicked: () => _onTabChanged(1),
        onRefreshTrainer: _loadTrainerData,
        onClientSelected: (email, name) {
          setState(() {
            _historyFilterEmail = email;
            _historyFilterName = name;
            _currentIndex = 3; // Switch to History tab
            
            // Rebuild history so it only tracks [0, 3]
            _navigationHistory.clear();
            _navigationHistory.add(0);
            _navigationHistory.add(3);
          });
        },
      ),
      _BookingsTab(trainerId: _trainer!.id, formatTime: _formatTime),
      _SlotsTab(trainer: _trainer!, formatTime: _formatTime),
      _HistoryTab(
        trainerId: _trainer!.id,
        formatTime: _formatTime,
        filterClientEmail: _historyFilterEmail,
        filterClientName: _historyFilterName,
        onClearFilter: () {
          setState(() {
            _historyFilterEmail = null;
            _historyFilterName = null;
          });
        },
      ),
      _ProfileTab(
        trainer: _trainer!,
        onProfileUpdated: (updatedTrainer) async {
          setState(() {
            _trainer = updatedTrainer;
          });
          final prefs = await SharedPreferences.getInstance();
          await prefs.setString('trainer', jsonEncode(updatedTrainer.toJson()));
        },
        onLogout: _logout,
      ),
    ];

    final currentTheme = _isLightBg ? AppTheme.lightTheme : AppTheme.darkTheme;

    return Theme(
      data: currentTheme,
      child: PopScope(
        canPop: false,
        onPopInvokedWithResult: (didPop, result) async {
          if (didPop) return;
          
          if (_currentIndex != 0) {
            if (_navigationHistory.length > 1) {
              setState(() {
                _navigationHistory.removeLast();
                _currentIndex = _navigationHistory.last;
                
                // Clear intermediate history so the next back press goes directly to Home
                _navigationHistory.clear();
                _navigationHistory.add(0);
                if (_currentIndex != 0) {
                  _navigationHistory.add(_currentIndex);
                }
              });
            } else {
              setState(() {
                _currentIndex = 0;
                _navigationHistory.clear();
                _navigationHistory.add(0);
              });
            }
            return;
          }

          // We are on the Home tab, show the exit confirmation dialog
          final shouldExit = await _showExitDialog();
          if (shouldExit) {
            SystemNavigator.pop();
          }
        },
        child: Container(
          decoration: BoxDecoration(
            gradient: _isLightBg ? AppColors.lightBackgroundGrad : AppColors.backgroundGrad,
          ),
          child: Scaffold(
            backgroundColor: Colors.transparent,
            appBar: (_currentIndex != 0 && _navigationHistory.length > 1)
                ? AppBar(
                    backgroundColor: Colors.transparent,
                    elevation: 0,
                    toolbarHeight: 48,
                    leading: IconButton(
                      icon: Icon(
                        Icons.arrow_back,
                        color: _isLightBg ? AppColors.black : Colors.white,
                      ),
                      onPressed: () {
                        setState(() {
                          _navigationHistory.removeLast();
                          _currentIndex = _navigationHistory.last;
                        });
                      },
                    ),
                    automaticallyImplyLeading: false,
                  )
                : null,
            body: SafeArea(
              child: IndexedStack(
                index: _currentIndex,
                children: tabs,
              ),
            ),
            bottomNavigationBar: Theme(
            data: Theme.of(context).copyWith(
              canvasColor: _isLightBg ? Colors.white : AppColors.black,
            ),
            child: BottomNavigationBar(
              currentIndex: _currentIndex,
              onTap: _onTabChanged,
              type: BottomNavigationBarType.fixed,
              selectedItemColor: _isLightBg ? AppColors.limeDim : AppColors.lime,
              unselectedItemColor: _isLightBg ? Colors.black38 : AppColors.textDim,
              selectedLabelStyle: const TextStyle(
                fontWeight: FontWeight.bold,
                fontSize: 11,
              ),
              unselectedLabelStyle: const TextStyle(fontSize: 11),
              items: const [
                BottomNavigationBarItem(
                  icon: Icon(Icons.home_outlined),
                  activeIcon: Icon(Icons.home),
                  label: 'Home',
                ),
                BottomNavigationBarItem(
                  icon: Icon(Icons.bookmark_outline),
                  activeIcon: Icon(Icons.bookmark),
                  label: 'Bookings',
                ),
                BottomNavigationBarItem(
                  icon: Icon(Icons.calendar_month_outlined),
                  activeIcon: Icon(Icons.calendar_month),
                  label: 'Slots',
                ),
                BottomNavigationBarItem(
                  icon: Icon(Icons.history_outlined),
                  activeIcon: Icon(Icons.history),
                  label: 'History',
                ),
                BottomNavigationBarItem(
                  icon: Icon(Icons.person_outline),
                  activeIcon: Icon(Icons.person),
                  label: 'Profile',
                ),
              ],
            ),
          ),
        ),
      ),
    ),
  );
}
}

// ----------------------------------------------------------------------
// 1. HOME TAB
// ----------------------------------------------------------------------
class _HomeTab extends StatefulWidget {
  final Trainer trainer;
  final String Function(String) formatTime;
  final VoidCallback onEditProfileClicked;
  final bool isLightTheme;
  final VoidCallback onToggleTheme;
  final VoidCallback? onSessionsTabClicked;
  final Future<void> Function()? onRefreshTrainer;
  final void Function(String email, String name)? onClientSelected;

  const _HomeTab({
    required this.trainer,
    required this.formatTime,
    required this.onEditProfileClicked,
    required this.isLightTheme,
    required this.onToggleTheme,
    this.onSessionsTabClicked,
    this.onRefreshTrainer,
    this.onClientSelected,
  });

  @override
  State<_HomeTab> createState() => _HomeTabState();
}

class _HomeTabState extends State<_HomeTab> {
  final SupabaseService _supabaseService = SupabaseService();
  final _searchController = TextEditingController();
  final _scrollController = ScrollController();
  final _searchFocusNode = FocusNode();

  List<Client> _clients = [];
  bool _isLoading = true;
  String _searchQuery = '';
  bool _showAllClients = false;

  @override
  void initState() {
    super.initState();
    _fetchClients();
  }

  @override
  void dispose() {
    _searchController.dispose();
    _scrollController.dispose();
    _searchFocusNode.dispose();
    super.dispose();
  }

  void _scrollToClients() {
    _searchFocusNode.requestFocus();
    _scrollController.animateTo(
      380.0,
      duration: const Duration(milliseconds: 500),
      curve: Curves.easeInOut,
    );
  }

  Future<void> _fetchClients() async {
    try {
      if (widget.onRefreshTrainer != null) {
        await widget.onRefreshTrainer!();
      }
      final data = await _supabaseService.getClients(widget.trainer.id);
      setState(() {
        _clients = data;
        _isLoading = false;
      });
    } catch (e) {
      debugPrint('Error fetching clients: $e');
      setState(() => _isLoading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    // Filter clients based on search query
    final filteredClients = _clients.where((c) {
      final q = _searchQuery.toLowerCase();
      return c.name.toLowerCase().contains(q) ||
          c.email.toLowerCase().contains(q) ||
          c.mobileNo.toLowerCase().contains(q);
    }).toList();

    final displayedClients = _showAllClients
        ? filteredClients
        : filteredClients.take(5).toList();

    final now = DateTime.now();

    final upcomingSessionsCount = _clients.fold<int>(0, (sum, c) {
      return sum + c.bookedSlots.where((s) {
        try {
          final slotDateTime = DateTime.parse('${s.slotDate}T${s.endTime}');
          return !slotDateTime.isBefore(now);
        } catch (_) {
          final todayStr = now.toString().split(' ')[0];
          return s.slotDate.compareTo(todayStr) >= 0;
        }
      }).length;
    });

    final completedEarnings = _clients.fold<double>(0.0, (sum, c) {
      return sum + c.bookedSlots.where((s) {
        try {
          final slotDateTime = DateTime.parse('${s.slotDate}T${s.endTime}');
          return slotDateTime.isBefore(now);
        } catch (_) {
          final todayStr = now.toString().split(' ')[0];
          return s.slotDate.compareTo(todayStr) < 0;
        }
      }).fold<double>(0.0, (subSum, s) => subSum + s.price);
    });

    final isLight = widget.isLightTheme;

    return RefreshIndicator(
      onRefresh: _fetchClients,
      color: isLight ? AppColors.limeDim : AppColors.lime,
      child: ListView(
        physics: const AlwaysScrollableScrollPhysics(),
        controller: _scrollController,
        padding: const EdgeInsets.all(20),
        children: [
          // Header Row
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'HELLO,',
                    style: TextStyle(
                      fontSize: 11,
                      fontWeight: FontWeight.bold,
                      letterSpacing: 2,
                      color: isLight ? AppColors.black.withOpacity(0.5) : AppColors.lime.withOpacity(0.8),
                    ),
                  ),
                  Text(
                    widget.trainer.name.toUpperCase(),
                    style: Theme.of(context).textTheme.titleLarge?.copyWith(
                      fontFamily: 'Archivo Black',
                      fontSize: 22,
                    ),
                  ),
                ],
              ),
              Row(
                children: [
                  IconButton(
                    icon: Icon(
                      isLight ? Icons.dark_mode_outlined : Icons.light_mode_outlined,
                      color: isLight ? AppColors.black : AppColors.lime,
                    ),
                    onPressed: widget.onToggleTheme,
                    tooltip: isLight ? 'Switch to Dark Mode' : 'Switch to Light Mode',
                  ),
                  const SizedBox(width: 8),
                  GestureDetector(
                    onTap: widget.onEditProfileClicked,
                    child: CircleAvatar(
                      radius: 22,
                      backgroundColor: isLight ? Colors.black.withOpacity(0.05) : AppColors.nearBlack,
                      backgroundImage: widget.trainer.imageUrl != null
                          ? NetworkImage(widget.trainer.imageUrl!)
                          : null,
                      child: widget.trainer.imageUrl == null
                          ? Icon(Icons.person, color: isLight ? AppColors.black : AppColors.textLight)
                          : null,
                    ),
                  ),
                ],
              ),
            ],
          ),
          const SizedBox(height: 24),

          // Live Clock & Greeting Banner
          _buildDateTimeBanner(context, isLight),
          const SizedBox(height: 24),

          // Trainer Info Card (Premium Glassmorphism Gradient)
          Container(
            decoration: BoxDecoration(
              color: isLight ? Colors.white : null,
              gradient: isLight ? null : AppColors.cardGrad,
              borderRadius: BorderRadius.circular(22),
              border: Border.all(color: isLight ? Colors.black12 : AppColors.inputBorder),
              boxShadow: isLight ? [
                BoxShadow(
                  color: Colors.black.withOpacity(0.04),
                  blurRadius: 10,
                  offset: const Offset(0, 4),
                )
              ] : null,
            ),
            padding: const EdgeInsets.all(20),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text(
                      widget.trainer.trainingType,
                      style: TextStyle(
                        color: isLight ? AppColors.limeDim : AppColors.lime,
                        fontWeight: FontWeight.bold,
                        fontSize: 14,
                      ),
                    ),
                    Text(
                      '\$${widget.trainer.sessionPrice.toStringAsFixed(2)}/hr',
                      style: TextStyle(
                        color: isLight ? AppColors.black : AppColors.textLight,
                        fontWeight: FontWeight.bold,
                        fontSize: 16,
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 8),
                Text(
                  'Experience: ${widget.trainer.experience}',
                  style: TextStyle(
                    color: isLight ? Colors.black54 : AppColors.textDim,
                    fontSize: 13,
                  ),
                ),
                const SizedBox(height: 16),
                ElevatedButton(
                  onPressed: widget.onEditProfileClicked,
                  style: ElevatedButton.styleFrom(
                    backgroundColor: isLight ? Colors.black.withOpacity(0.04) : Colors.white.withOpacity(0.06),
                    foregroundColor: isLight ? AppColors.black : AppColors.textLight,
                    side: BorderSide(color: isLight ? Colors.black12 : AppColors.inputBorder),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(10),
                    ),
                    padding: const EdgeInsets.symmetric(
                      horizontal: 16,
                      vertical: 10,
                    ),
                  ),
                  child: const Text(
                    'Edit Profile Details',
                    style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 24),

          // Stats Widgets Row
          Row(
            children: [
              Expanded(
                child: _buildStatCell(
                  'Active Clients',
                  _isLoading ? '...' : _clients.length.toString(),
                  isLight,
                  onTap: _scrollToClients,
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: _buildStatCell(
                  'Sessions',
                  _isLoading ? '...' : upcomingSessionsCount.toString(),
                  isLight,
                  onTap: widget.onSessionsTabClicked,
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: _buildStatCell(
                  'Earnings',
                  _isLoading ? '...' : '\$${completedEarnings.toStringAsFixed(0)}',
                  isLight,
                ),
              ),
            ],
          ),
          const SizedBox(height: 28),

          // Your Clients Section Header
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                'YOUR CLIENTS',
                style: TextStyle(
                  fontSize: 11,
                  fontWeight: FontWeight.bold,
                  letterSpacing: 2,
                  color: isLight ? Colors.black38 : AppColors.textDim,
                ),
              ),
              Text(
                '${filteredClients.length} Total',
                style: TextStyle(
                  fontSize: 12,
                  color: isLight ? AppColors.limeDim : AppColors.lime,
                  fontWeight: FontWeight.bold,
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),

          // Search Field
          TextField(
            controller: _searchController,
            focusNode: _searchFocusNode,
            onChanged: (val) => setState(() => _searchQuery = val),
            style: TextStyle(color: isLight ? AppColors.black : AppColors.textLight, fontSize: 13),
            decoration: InputDecoration(
              hintText: 'Search by client name, email or phone...',
              prefixIcon: Icon(
                Icons.search,
                color: isLight ? Colors.black38 : AppColors.textDim,
                size: 20,
              ),
              suffixIcon: _searchQuery.isNotEmpty
                  ? IconButton(
                      icon: Icon(
                        Icons.clear,
                        color: isLight ? Colors.black38 : AppColors.textDim,
                        size: 18,
                      ),
                      onPressed: () {
                        _searchController.clear();
                        setState(() => _searchQuery = '');
                      },
                    )
                  : null,
            ),
          ),
          const SizedBox(height: 16),

          // Clients list
          if (_isLoading)
            Center(
              child: Padding(
                padding: const EdgeInsets.all(24),
                child: CircularProgressIndicator(color: isLight ? AppColors.limeDim : AppColors.lime),
              ),
            )
          else if (filteredClients.isEmpty)
            Container(
              padding: const EdgeInsets.all(24),
              decoration: BoxDecoration(
                color: isLight ? Colors.white : AppColors.nearBlack,
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: isLight ? Colors.black12 : Colors.white10),
              ),
              child: Center(
                child: Text(
                  'No clients found matching query.',
                  style: TextStyle(color: isLight ? Colors.black38 : AppColors.textDim, fontSize: 13),
                ),
              ),
            )
          else
            ListView.separated(
              shrinkWrap: true,
              physics: const NeverScrollableScrollPhysics(),
              itemCount: displayedClients.length,
              separatorBuilder: (_, __) => const SizedBox(height: 10),
              itemBuilder: (context, index) {
                final client = displayedClients[index];

                return Container(
                  decoration: BoxDecoration(
                    color: isLight ? Colors.white : AppColors.nearBlack,
                    borderRadius: BorderRadius.circular(16),
                    border: Border.all(color: isLight ? Colors.black12 : Colors.white10),
                    boxShadow: isLight ? [
                      BoxShadow(
                        color: Colors.black.withOpacity(0.03),
                        blurRadius: 8,
                        offset: const Offset(0, 2),
                      )
                    ] : null,
                  ),
                  child: ListTile(
                    leading: CircleAvatar(
                      backgroundColor: isLight ? Colors.black.withOpacity(0.05) : Colors.white10,
                      backgroundImage: client.avatarUrl.isNotEmpty
                          ? NetworkImage(client.avatarUrl)
                          : null,
                      child: client.avatarUrl.isEmpty
                          ? Icon(
                              Icons.person,
                              color: isLight ? Colors.black54 : AppColors.textDim,
                            )
                          : null,
                    ),
                    title: Text(
                      client.name,
                      style: TextStyle(
                        color: isLight ? AppColors.black : AppColors.textLight,
                        fontWeight: FontWeight.bold,
                        fontSize: 14,
                      ),
                    ),
                    onTap: () {
                      if (widget.onClientSelected != null) {
                        widget.onClientSelected!(client.email, client.name);
                      }
                    },
                  ),
                );
              },
            ),
            if (!_showAllClients && filteredClients.length > 5) ...[
              const SizedBox(height: 12),
              Center(
                child: TextButton.icon(
                  onPressed: () {
                    setState(() {
                      _showAllClients = true;
                    });
                  },
                  icon: Icon(
                    Icons.expand_more,
                    color: isLight ? const Color(0xFF4E6600) : AppColors.lime,
                  ),
                  label: Text(
                    'See More',
                    style: TextStyle(
                      color: isLight ? const Color(0xFF4E6600) : AppColors.lime,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                ),
              ),
            ],
        ],
      ),
    );
  }

  Widget _buildStatCell(String label, String val, bool isLight, {VoidCallback? onTap}) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        decoration: BoxDecoration(
          color: isLight ? Colors.white : AppColors.nearBlack,
          border: Border.all(color: isLight ? Colors.black12 : Colors.white10),
          borderRadius: BorderRadius.circular(16),
          boxShadow: isLight ? [
            BoxShadow(
              color: Colors.black.withOpacity(0.04),
              blurRadius: 10,
              offset: const Offset(0, 4),
            )
          ] : null,
        ),
        padding: const EdgeInsets.symmetric(vertical: 12),
        child: Column(
          children: [
            Text(
              val,
              style: TextStyle(
                fontSize: 18,
                fontWeight: FontWeight.bold,
                color: isLight ? AppColors.limeDim : AppColors.lime,
                fontFamily: 'Archivo Black',
              ),
            ),
            const SizedBox(height: 2),
            Text(
              label,
              style: TextStyle(fontSize: 10, color: isLight ? Colors.black54 : AppColors.textDim),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildDateTimeBanner(BuildContext context, bool isLight) {
    return StreamBuilder<DateTime>(
      stream: Stream.periodic(const Duration(seconds: 1), (_) => DateTime.now()),
      initialData: DateTime.now(),
      builder: (context, snapshot) {
        final now = snapshot.data ?? DateTime.now();
        
        final timeStr = _formatTimeString(now);
        final dateStr = _formatDateString(now);
        final greeting = _getGreeting(now);

        return Container(
          decoration: BoxDecoration(
            color: isLight ? AppColors.limeDim.withOpacity(0.05) : AppColors.nearBlack,
            borderRadius: BorderRadius.circular(16),
            border: Border.all(
              color: isLight ? AppColors.limeDim.withOpacity(0.1) : AppColors.lime.withOpacity(0.1),
            ),
          ),
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    greeting.toUpperCase(),
                    style: TextStyle(
                      fontSize: 10,
                      fontWeight: FontWeight.bold,
                      letterSpacing: 1.5,
                      color: isLight ? AppColors.limeDim : AppColors.lime,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    dateStr,
                    style: TextStyle(
                      fontSize: 13,
                      fontWeight: FontWeight.w500,
                      color: isLight ? Colors.black87 : AppColors.textLight,
                    ),
                  ),
                ],
              ),
              Row(
                children: [
                  Icon(
                    _getGreetingIcon(now),
                    color: isLight ? AppColors.limeDim : AppColors.lime,
                    size: 20,
                  ),
                  const SizedBox(width: 8),
                  Text(
                    timeStr,
                    style: TextStyle(
                      fontSize: 16,
                      fontWeight: FontWeight.bold,
                      fontFamily: 'monospace',
                      color: isLight ? Colors.black : AppColors.textLight,
                    ),
                  ),
                ],
              ),
            ],
          ),
        );
      },
    );
  }

  String _formatTimeString(DateTime dateTime) {
    final hour = dateTime.hour;
    final min = dateTime.minute.toString().padLeft(2, '0');
    final sec = dateTime.second.toString().padLeft(2, '0');
    final ampm = hour >= 12 ? 'PM' : 'AM';
    final displayHour = hour % 12 == 0 ? 12 : hour % 12;
    return '$displayHour:$min:$sec $ampm';
  }

  String _formatDateString(DateTime dateTime) {
    final weekdayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    final monthNames = [
      'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 
      'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
    ];
    final weekday = weekdayNames[dateTime.weekday % 7];
    final day = dateTime.day;
    final month = monthNames[dateTime.month - 1];
    final year = dateTime.year;
    return '$weekday, $month $day, $year';
  }

  String _getGreeting(DateTime dateTime) {
    final hour = dateTime.hour;
    if (hour < 12) {
      return 'Good Morning';
    } else if (hour < 17) {
      return 'Good Afternoon';
    } else {
      return 'Good Evening';
    }
  }

  IconData _getGreetingIcon(DateTime dateTime) {
    final hour = dateTime.hour;
    if (hour < 6 || hour >= 18) {
      return Icons.nights_stay;
    } else if (hour < 12) {
      return Icons.wb_twilight;
    } else {
      return Icons.wb_sunny;
    }
  }

}

// ----------------------------------------------------------------------
// 2. BOOKINGS TAB (UPCOMING SESSIONS)
// ----------------------------------------------------------------------
class _BookingsTab extends StatefulWidget {
  final String trainerId;
  final String Function(String) formatTime;

  const _BookingsTab({required this.trainerId, required this.formatTime});

  @override
  State<_BookingsTab> createState() => _BookingsTabState();
}

class _BookingsTabState extends State<_BookingsTab> {
  final SupabaseService _supabaseService = SupabaseService();
  List<TrainerSlot> _bookedSlots = [];
  bool _isLoading = true;

  @override
  void initState() {
    super.initState();
    _fetchBookings();
  }

  Future<void> _fetchBookings() async {
    try {
      final List<dynamic> rows = await _supabaseService.client
          .from('trainer_slots')
          .select('*')
          .eq('trainer_id', widget.trainerId)
          .eq('status', 'booked')
          .order('slot_date', ascending: true)
          .order('start_time', ascending: true);

      final List<TrainerSlot> slots = rows
          .map((e) => TrainerSlot.fromJson(e as Map<String, dynamic>))
          .toList();

      // Keep only slots from today onwards to represent upcoming bookings
      final todayStr = DateTime.now().toString().split(' ')[0];
      final upcoming = slots
          .where((s) => s.slotDate.compareTo(todayStr) >= 0)
          .toList();

      setState(() {
        _bookedSlots = upcoming;
        _isLoading = false;
      });
    } catch (e) {
      debugPrint('Error fetching bookings: $e');
      setState(() => _isLoading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final isLight = Theme.of(context).brightness == Brightness.light;
    final labelColor = isLight ? AppColors.black : AppColors.textLight;
    final subLabelColor = isLight ? Colors.black54 : AppColors.textDim;
    final cardBgColor = isLight ? Colors.white : AppColors.nearBlack;
    final borderColor = isLight ? Colors.black12 : Colors.white10;

    return RefreshIndicator(
      onRefresh: _fetchBookings,
      color: isLight ? AppColors.limeDim : AppColors.lime,
      child: ListView(
        padding: const EdgeInsets.all(20),
        children: [
          Text(
            'UPCOMING SESSIONS',
            style: Theme.of(
              context,
            ).textTheme.displayMedium?.copyWith(
              fontSize: 22,
              color: labelColor,
            ),
          ),
          const SizedBox(height: 6),
          Text(
            'Your upcoming booked appointments with clients.',
            style: TextStyle(color: subLabelColor, fontSize: 13),
          ),
          const SizedBox(height: 24),
          if (_isLoading)
            Center(
              child: CircularProgressIndicator(color: isLight ? AppColors.limeDim : AppColors.lime),
            )
          else if (_bookedSlots.isEmpty)
            Container(
              padding: const EdgeInsets.all(32),
              decoration: BoxDecoration(
                color: cardBgColor,
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: borderColor),
                boxShadow: isLight ? [
                  BoxShadow(
                    color: Colors.black.withOpacity(0.04),
                    blurRadius: 10,
                    offset: const Offset(0, 4),
                  )
                ] : null,
              ),
              child: Column(
                children: [
                  Icon(
                    Icons.calendar_today,
                    size: 48,
                    color: subLabelColor,
                  ),
                  const SizedBox(height: 16),
                  Text(
                    'No upcoming appointments scheduled.',
                    style: TextStyle(color: subLabelColor, fontSize: 13),
                    textAlign: TextAlign.center,
                  ),
                ],
              ),
            )
          else
            ListView.separated(
              shrinkWrap: true,
              physics: const NeverScrollableScrollPhysics(),
              itemCount: _bookedSlots.length,
              separatorBuilder: (_, __) => const SizedBox(height: 12),
              itemBuilder: (context, index) {
                final slot = _bookedSlots[index];

                return Container(
                  decoration: BoxDecoration(
                    color: cardBgColor,
                    borderRadius: BorderRadius.circular(18),
                    border: Border.all(color: borderColor),
                    boxShadow: isLight ? [
                      BoxShadow(
                        color: Colors.black.withOpacity(0.03),
                        blurRadius: 8,
                        offset: const Offset(0, 2),
                      )
                    ] : null,
                  ),
                  padding: const EdgeInsets.all(16),
                  child: Row(
                    children: [
                      // Date circle indicator
                      Container(
                        width: 52,
                        height: 52,
                        decoration: BoxDecoration(
                          color: isLight ? AppColors.limeDim.withOpacity(0.1) : AppColors.lime.withOpacity(0.08),
                          borderRadius: BorderRadius.circular(12),
                          border: Border.all(
                            color: isLight ? AppColors.limeDim.withOpacity(0.3) : AppColors.lime.withOpacity(0.2),
                          ),
                        ),
                        child: Column(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            Text(
                              slot.slotDate.split('-')[2], // Day
                              style: TextStyle(
                                color: isLight ? AppColors.limeDim : AppColors.lime,
                                fontSize: 18,
                                fontWeight: FontWeight.bold,
                                fontFamily: 'Archivo Black',
                              ),
                            ),
                            Text(
                              _getMonthAbbreviation(slot.slotDate),
                              style: TextStyle(
                                color: isLight ? Colors.black87 : AppColors.textLight,
                                fontSize: 9,
                                fontWeight: FontWeight.bold,
                              ),
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(width: 16),
                      // Appointment details
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              slot.bookedByName ?? 'Client',
                              style: TextStyle(
                                color: labelColor,
                                fontWeight: FontWeight.bold,
                                fontSize: 14,
                              ),
                            ),
                            const SizedBox(height: 4),
                            Text(
                              slot.bookedByEmail ?? '',
                              style: TextStyle(
                                color: subLabelColor,
                                fontSize: 11,
                              ),
                            ),
                            const SizedBox(height: 6),
                            Row(
                              children: [
                                Icon(
                                  Icons.access_time,
                                  size: 13,
                                  color: isLight ? AppColors.limeDim : AppColors.lime,
                                ),
                                const SizedBox(width: 4),
                                Text(
                                  '${widget.formatTime(slot.startTime)} - ${widget.formatTime(slot.endTime)}',
                                  style: TextStyle(
                                    color: isLight ? AppColors.limeDim : AppColors.lime,
                                    fontWeight: FontWeight.bold,
                                    fontSize: 11,
                                  ),
                                ),
                              ],
                            ),
                          ],
                        ),
                      ),
                      // Session price
                      Text(
                        '\$${slot.price.toStringAsFixed(0)}',
                        style: TextStyle(
                          fontSize: 16,
                          fontWeight: FontWeight.bold,
                          color: labelColor,
                        ),
                      ),
                    ],
                  ),
                );
              },
            ),
        ],
      ),
    );
  }

  String _getMonthAbbreviation(String dateStr) {
    try {
      final date = DateTime.parse(dateStr);
      final months = [
        'JAN',
        'FEB',
        'MAR',
        'APR',
        'MAY',
        'JUN',
        'JUL',
        'AUG',
        'SEP',
        'OCT',
        'NOV',
        'DEC',
      ];
      return months[date.month - 1];
    } catch (_) {
      return 'MMM';
    }
  }
}

// ----------------------------------------------------------------------
// 3. SLOTS TAB (WEEKDAY TEMPLATE MANAGER)
// ----------------------------------------------------------------------
class _SlotsTab extends StatefulWidget {
  final Trainer trainer;
  final String Function(String) formatTime;

  const _SlotsTab({required this.trainer, required this.formatTime});

  @override
  State<_SlotsTab> createState() => _SlotsTabState();
}

class _SlotsTabState extends State<_SlotsTab> {
  final SupabaseService _supabaseService = SupabaseService();
  List<TrainerSlot> _slots = [];
  bool _isLoading = true;
  String? _errorMsg;
  bool _showMoreSlots = false;
  final Set<String> _initiallyActiveOutside9To5 = {};
  SharedPreferences? _prefs;

  void _updateInitiallyActiveOutside9To5() {
    _initiallyActiveOutside9To5.clear();
    final daySlots = _slots.where((s) => s.slotDate == _selectedDayFilter);
    final cacheKey = 'active_slots_${widget.trainer.id}_$_selectedDayFilter';
    final cachedTimes = _prefs?.getStringList(cacheKey) ?? [];

    for (final slot in daySlots) {
      final int hour = int.parse(slot.startTime.split(':')[0]);
      final bool isDefault9To5 = (hour >= 9 && hour < 17);
      if (!isDefault9To5) {
        if (slot.isActive || cachedTimes.contains(slot.startTime)) {
          _initiallyActiveOutside9To5.add(slot.id);
        }
      }
    }
  }

  // Day filter Monday-Sunday mapping to reference dates
  final List<Map<String, dynamic>> _weekdays = [
    {'dateString': '1970-01-05', 'label': 'Mon', 'fullName': 'Monday'},
    {'dateString': '1970-01-06', 'label': 'Tue', 'fullName': 'Tuesday'},
    {'dateString': '1970-01-07', 'label': 'Wed', 'fullName': 'Wednesday'},
    {'dateString': '1970-01-08', 'label': 'Thu', 'fullName': 'Thursday'},
    {'dateString': '1970-01-09', 'label': 'Fri', 'fullName': 'Friday'},
    {'dateString': '1970-01-10', 'label': 'Sat', 'fullName': 'Saturday'},
    {'dateString': '1970-01-11', 'label': 'Sun', 'fullName': 'Sunday'},
  ];

  late String _selectedDayFilter;

  @override
  void initState() {
    super.initState();
    _selectedDayFilter = _getTodayReferenceDate();
    _initPrefsAndLoad();
  }

  Future<void> _initPrefsAndLoad() async {
    _prefs = await SharedPreferences.getInstance();
    if (mounted) {
      _fetchSlots();
    }
  }

  String _getTodayReferenceDate() {
    final int wday = DateTime.now().weekday; // 1: Mon, 7: Sun
    return _weekdays[wday - 1]['dateString'] as String;
  }

  Future<void> _fetchSlots({bool isDayToggle = false}) async {
    try {
      final data = await _supabaseService.fetchSlots(
        widget.trainer.id,
        widget.trainer.sessionPrice,
      );
      setState(() {
        _slots = data;
        _isLoading = false;
        if (!isDayToggle) {
          _updateInitiallyActiveOutside9To5();
        }
      });
    } catch (e) {
      debugPrint('Error fetching slots: $e');
      setState(() {
        _errorMsg = e.toString();
        _isLoading = false;
      });
    }
  }

  void _handleDeleteSlot(String id) async {
    final confirm = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: AppColors.nearBlack,
        title: const Text(
          'Delete Slot',
          style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold),
        ),
        content: const Text(
          'Are you sure you want to delete this template slot?',
          style: TextStyle(color: Colors.white70),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(false),
            child: const Text(
              'Cancel',
              style: TextStyle(color: Colors.white70),
            ),
          ),
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(true),
            child: const Text(
              'Delete',
              style: TextStyle(color: Colors.redAccent),
            ),
          ),
        ],
      ),
    );

    if (confirm == true) {
      try {
        await _supabaseService.deleteSlot(id, widget.trainer.id);
        setState(() {
          _slots.removeWhere((s) => s.id == id);
        });
      } catch (e) {
        if (context.mounted) {
          ScaffoldMessenger.of(
            context,
          ).showSnackBar(SnackBar(content: Text('Failed to delete: $e')));
        }
      }
    }
  }

  void _handleToggleSlotActive(TrainerSlot slot) async {
    final originalActive = slot.isActive;
    // Optimistic UI state toggle
    setState(() {
      final index = _slots.indexWhere((s) => s.id == slot.id);
      if (index != -1) {
        _slots[index] = slot.copyWith(isActive: !originalActive);
      }
    });

    try {
      final updated = await _supabaseService.updateSlot(slot.id, {
        'is_active': !originalActive,
      });
      setState(() {
        final index = _slots.indexWhere((s) => s.id == slot.id);
        if (index != -1) {
          _slots[index] = updated;
        }
      });
    } catch (e) {
      // Revert on error
      setState(() {
        final index = _slots.indexWhere((s) => s.id == slot.id);
        if (index != -1) {
          _slots[index] = slot.copyWith(isActive: originalActive);
        }
      });
      if (context.mounted) {
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(SnackBar(content: Text('Update failed: $e')));
      }
    }
  }

  void _handleToggleDayActive(String dayString, bool currentIsActive) async {
    final prefs = await SharedPreferences.getInstance();
    final cacheKey = 'active_slots_${widget.trainer.id}_$dayString';

    List<String>? timesToActivate;

    if (currentIsActive) {
      // Day is currently active, user is turning it OFF.
      // Save times of currently active slots.
      final activeTimes = _slots
          .where((s) => s.slotDate == dayString && s.isActive && s.status != 'booked')
          .map((s) => s.startTime)
          .toList();
      await prefs.setStringList(cacheKey, activeTimes);
    } else {
      // Day is currently inactive, user is turning it ON.
      // Retrieve the saved active slot times.
      timesToActivate = prefs.getStringList(cacheKey);
      if (timesToActivate == null || timesToActivate.isEmpty) {
        // Fallback to default 9-5
        timesToActivate = [
          '09:00:00', '10:00:00', '11:00:00', '12:00:00',
          '13:00:00', '14:00:00', '15:00:00', '16:00:00'
        ];
      }
    }

    // Optimistic update
    setState(() {
      _slots = _slots.map((s) {
        if (s.slotDate == dayString && s.status != 'booked') {
          final isSlotActive = !currentIsActive && (timesToActivate?.contains(s.startTime) ?? false);
          return s.copyWith(isActive: isSlotActive);
        }
        return s;
      }).toList();
    });

    try {
      await _supabaseService.toggleDaySlots(
        widget.trainer.id,
        dayString,
        !currentIsActive,
        timesToActivate: timesToActivate,
      );
      _fetchSlots(isDayToggle: true); // Refresh list to get accurate synced data without resetting the visible rows!
    } catch (e) {
      _fetchSlots(isDayToggle: true); // Revert back via db pull on error
      if (context.mounted) {
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(SnackBar(content: Text('Group toggle failed: $e')));
      }
    }
  }

  void _handleAddSlot(String startTime, String endTime) async {
    setState(() {
      _isLoading = true;
    });

    try {
      final newSlot = await _supabaseService.createSlot(
        trainerId: widget.trainer.id,
        slotDate: _selectedDayFilter,
        startTime: startTime,
        endTime: endTime,
        price: widget.trainer.sessionPrice,
      );

      setState(() {
        _slots.add(newSlot);
        _initiallyActiveOutside9To5.add(newSlot.id);
        _slots.sort((a, b) {
          final dateCompare = a.slotDate.compareTo(b.slotDate);
          if (dateCompare != 0) return dateCompare;
          return a.startTime.compareTo(b.startTime);
        });
        _isLoading = false;
      });
    } catch (e) {
      setState(() {
        _isLoading = false;
      });
      if (context.mounted) {
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(SnackBar(content: Text('Failed to add slot: $e')));
      }
    }
  }

  void _showAddSlotDialog(BuildContext context, List<int> missingHours) {
    final isLight = Theme.of(context).brightness == Brightness.light;
    final labelColor = isLight ? AppColors.black : AppColors.textLight;
    final bottomSheetBg = isLight ? Colors.white : AppColors.nearBlack;
    final dividerColor = isLight ? Colors.black12 : Colors.white10;

    showModalBottomSheet(
      context: context,
      backgroundColor: bottomSheetBg,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (ctx) {
        return SafeArea(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Padding(
                padding: const EdgeInsets.all(20),
                child: Text(
                  'Add Slot',
                  style: TextStyle(
                    color: labelColor,
                    fontSize: 18,
                    fontWeight: FontWeight.bold,
                  ),
                ),
              ),
              Divider(color: dividerColor, height: 1),
              Expanded(
                child: ListView.separated(
                  padding: const EdgeInsets.all(20),
                  itemCount: missingHours.length,
                  separatorBuilder: (_, __) => const SizedBox(height: 8),
                  itemBuilder: (subCtx, index) {
                    final h = missingHours[index];
                    final startHourStr = h.toString().padLeft(2, '0');
                    final startTime = '$startHourStr:00:00';
                    final endHour = h + 1;
                    final endTime = endHour == 24 ? '00:00:00' : '${endHour.toString().padLeft(2, '0')}:00:00';

                    final displayTime = '${widget.formatTime(startTime)} - ${widget.formatTime(endTime)}';

                    return InkWell(
                      onTap: () {
                        Navigator.of(subCtx).pop();
                        _handleAddSlot(startTime, endTime);
                      },
                      borderRadius: BorderRadius.circular(12),
                      child: Container(
                        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
                        decoration: BoxDecoration(
                          border: Border.all(color: dividerColor),
                          borderRadius: BorderRadius.circular(12),
                        ),
                        child: Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            Text(
                              displayTime,
                              style: TextStyle(
                                color: labelColor,
                                fontWeight: FontWeight.w500,
                              ),
                            ),
                            Icon(
                              Icons.add_circle_outline,
                              color: isLight ? AppColors.limeDim : AppColors.lime,
                            ),
                          ],
                        ),
                      ),
                    );
                  },
                ),
              ),
            ],
          ),
        );
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    // Filter slots by selected weekday template
    final daySlots = _slots
        .where((s) => s.slotDate == _selectedDayFilter)
        .toList();
        
    final List<TrainerSlot> visibleSlots = daySlots.where((slot) {
      final int hour = int.parse(slot.startTime.split(':')[0]);
      final bool isDefault9To5 = (hour >= 9 && hour < 17);
      
      if (isDefault9To5) {
        return true; // Always visible (on or off)
      }
      if (_initiallyActiveOutside9To5.contains(slot.id)) {
        return true; // Was active initially when day selected -> visible
      }
      if (slot.isActive) {
        return true; // Outside 9-5 but active -> visible
      }
      return _showMoreSlots; // Otherwise, only visible if expand clicked
    }).toList();

    // Check if there are any hidden slots outside 9-5 that are currently inactive
    final bool hasHiddenSlots = daySlots.any((slot) {
      final int hour = int.parse(slot.startTime.split(':')[0]);
      final bool isDefault9To5 = (hour >= 9 && hour < 17);
      return !isDefault9To5 && !slot.isActive;
    });

    final bool isDayActive = daySlots.any(
      (s) => s.isActive && s.status != 'booked',
    );
    final String dayFullName =
        _weekdays.firstWhere(
              (w) => w['dateString'] == _selectedDayFilter,
            )['fullName']
            as String;

    // Calculate missing hours for the selected weekday
    final Set<int> existingHours = daySlots.map((s) {
      final parts = s.startTime.split(':');
      return int.tryParse(parts[0]) ?? -1;
    }).toSet();

    final List<int> missingHours = [];
    for (int h = 0; h < 24; h++) {
      if (!existingHours.contains(h)) {
        missingHours.add(h);
      }
    }

    final isLight = Theme.of(context).brightness == Brightness.light;
    final labelColor = isLight ? AppColors.black : AppColors.textLight;
    final subLabelColor = isLight ? Colors.black54 : AppColors.textDim;
    final cardBgColor = isLight ? Colors.white : AppColors.nearBlack;
    final borderColor = isLight ? Colors.black12 : Colors.white10;
    final accentColor = isLight ? const Color(0xFF4E6600) : AppColors.lime;

    return RefreshIndicator(
      onRefresh: _fetchSlots,
      color: isLight ? AppColors.limeDim : AppColors.lime,
      child: ListView(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.all(20),
        children: [
        Text(
          'SLOTS PLANNER',
          style: Theme.of(
            context,
          ).textTheme.displayMedium?.copyWith(
            fontSize: 22,
            color: labelColor,
          ),
        ),
        const SizedBox(height: 6),
        Text(
          'Manage your typical weekly schedule. Active hours are open for booking.',
          style: TextStyle(color: subLabelColor, fontSize: 13),
        ),
        const SizedBox(height: 24),

        // Weekday Horizontal Toggles Selector
        SizedBox(
          height: 48,
          child: ListView.separated(
            scrollDirection: Axis.horizontal,
            itemCount: _weekdays.length,
            separatorBuilder: (_, __) => const SizedBox(width: 8),
            itemBuilder: (context, index) {
              final day = _weekdays[index];
              final isSelected = _selectedDayFilter == day['dateString'];

              return GestureDetector(
                onTap: () {
                  setState(() {
                    _selectedDayFilter = day['dateString'] as String;
                    _showMoreSlots = false;
                    _updateInitiallyActiveOutside9To5();
                  });
                },
                child: Container(
                  decoration: BoxDecoration(
                    color: isSelected
                        ? (isLight ? AppColors.limeDim : AppColors.lime)
                        : cardBgColor,
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(
                      color: isSelected
                          ? (isLight ? AppColors.limeDim : AppColors.lime)
                          : borderColor,
                    ),
                    boxShadow: (isLight && !isSelected) ? [
                      BoxShadow(
                        color: Colors.black.withOpacity(0.03),
                        blurRadius: 4,
                        offset: const Offset(0, 2),
                      )
                    ] : null,
                  ),
                  padding: const EdgeInsets.symmetric(horizontal: 16),
                  alignment: Alignment.center,
                  child: Text(
                    day['label'] as String,
                    style: TextStyle(
                      color: isSelected
                          ? (isLight ? Colors.white : AppColors.black)
                          : labelColor,
                      fontWeight: FontWeight.bold,
                      fontSize: 13,
                    ),
                  ),
                ),
              );
            },
          ),
        ),
        const SizedBox(height: 24),

        if (_isLoading)
          Center(child: CircularProgressIndicator(color: isLight ? AppColors.limeDim : AppColors.lime))
        else ...[
          // Day Active Toggle Card
          Container(
            decoration: BoxDecoration(
              color: cardBgColor,
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: borderColor),
              boxShadow: isLight ? [
                BoxShadow(
                  color: Colors.black.withOpacity(0.04),
                  blurRadius: 10,
                  offset: const Offset(0, 4),
                )
              ] : null,
            ),
            padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Available on $dayFullName',
                      style: TextStyle(
                        fontWeight: FontWeight.bold,
                        color: labelColor,
                        fontSize: 14,
                      ),
                    ),
                    Text(
                      isDayActive
                          ? 'Trainer is active'
                          : 'Trainer is unavailable',
                      style: TextStyle(
                        color: isDayActive
                            ? (isLight ? AppColors.limeDim : AppColors.lime)
                            : subLabelColor,
                        fontSize: 11,
                      ),
                    ),
                  ],
                ),
                Switch(
                  value: isDayActive,
                  activeColor: isLight ? AppColors.limeDim : AppColors.lime,
                  onChanged: (val) =>
                      _handleToggleDayActive(_selectedDayFilter, isDayActive),
                ),
              ],
            ),
          ),
          const SizedBox(height: 20),

          // Hourly list
          if (_errorMsg != null)
            Text(
              'Error: $_errorMsg',
              style: const TextStyle(color: Colors.redAccent),
            )
          else ...[
            if (visibleSlots.isEmpty)
              Padding(
                padding: const EdgeInsets.symmetric(vertical: 24),
                child: Center(
                  child: Text(
                    'No slots configured for this day.',
                    style: TextStyle(color: subLabelColor),
                  ),
                ),
              )
            else
              ListView.separated(
                shrinkWrap: true,
                physics: const NeverScrollableScrollPhysics(),
                itemCount: visibleSlots.length,
                separatorBuilder: (_, __) => const SizedBox(height: 10),
                itemBuilder: (context, index) {
                  final slot = visibleSlots[index];
                  final isBooked = slot.status == 'booked';

                  return Container(
                    decoration: BoxDecoration(
                      color: isBooked
                          ? (isLight ? Colors.black.withOpacity(0.02) : Colors.white.withValues(alpha: 0.01))
                          : cardBgColor,
                      borderRadius: BorderRadius.circular(16),
                      border: Border.all(
                        color: isBooked
                          ? Colors.redAccent.withValues(alpha: 0.1)
                          : borderColor,
                      ),
                      boxShadow: (isLight && !isBooked) ? [
                        BoxShadow(
                          color: Colors.black.withOpacity(0.03),
                          blurRadius: 6,
                          offset: const Offset(0, 2),
                        )
                      ] : null,
                    ),
                    padding: const EdgeInsets.symmetric(
                      horizontal: 16,
                      vertical: 12,
                    ),
                    child: Row(
                      children: [
                        // Time Text
                        Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              '${widget.formatTime(slot.startTime)} - ${widget.formatTime(slot.endTime)}',
                              style: TextStyle(
                                color: isBooked
                                    ? subLabelColor
                                    : labelColor,
                                fontWeight: FontWeight.bold,
                                fontSize: 14,
                              ),
                            ),
                            if (isBooked)
                              const Text(
                                'BOOKED BY CLIENT',
                                style: TextStyle(
                                  color: Colors.redAccent,
                                  fontSize: 9,
                                  fontWeight: FontWeight.bold,
                                ),
                              ),
                          ],
                        ),
                        const Spacer(),
                        // Actions: Toggles/Icons
                        if (isBooked) ...[
                          Text(
                            slot.bookedByName ?? 'Booked',
                            style: TextStyle(
                              color: subLabelColor,
                              fontSize: 12,
                            ),
                          ),
                          const SizedBox(width: 8),
                          Icon(
                            Icons.lock_outline,
                            color: subLabelColor,
                            size: 18,
                          ),
                        ] else ...[
                          // Delete individual slot
                          IconButton(
                            icon: Icon(
                              Icons.delete_outline,
                              color: subLabelColor,
                              size: 20,
                            ),
                            onPressed: () => _handleDeleteSlot(slot.id),
                          ),
                          Switch(
                            value: slot.isActive,
                            activeThumbColor: isLight ? AppColors.limeDim : AppColors.lime,
                            onChanged: (val) => _handleToggleSlotActive(slot),
                          ),
                        ],
                      ],
                    ),
                  );
                },
              ),
            if (hasHiddenSlots) ...[
              const SizedBox(height: 12),
              Center(
                child: TextButton.icon(
                  onPressed: () {
                    setState(() {
                      _showMoreSlots = !_showMoreSlots;
                    });
                  },
                  icon: Icon(
                    _showMoreSlots ? Icons.expand_less : Icons.expand_more,
                    color: accentColor,
                  ),
                  label: Text(
                    _showMoreSlots ? 'Show Less Slots' : 'Show All Slots',
                    style: TextStyle(
                      color: accentColor,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                ),
              ),
            ],
            if (missingHours.isNotEmpty) ...[
              const SizedBox(height: 12),
              GestureDetector(
                onTap: () => _showAddSlotDialog(context, missingHours),
                child: Container(
                  padding: const EdgeInsets.symmetric(vertical: 14),
                  decoration: BoxDecoration(
                    color: Colors.transparent,
                    borderRadius: BorderRadius.circular(16),
                    border: Border.all(
                      color: accentColor.withValues(alpha: 0.3),
                      style: BorderStyle.solid,
                    ),
                  ),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Icon(Icons.add, color: accentColor, size: 20),
                      const SizedBox(width: 8),
                      Text(
                        'Add Slot',
                        style: TextStyle(
                          color: accentColor,
                          fontWeight: FontWeight.bold,
                          fontSize: 14,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ],
          ],
        ],
      ],
    ),
  );
}
}

// ----------------------------------------------------------------------
// 4. HISTORY TAB (PAST BOOKED SESSIONS)
// ----------------------------------------------------------------------
class _HistoryTab extends StatefulWidget {
  final String trainerId;
  final String Function(String) formatTime;
  final String? filterClientEmail;
  final String? filterClientName;
  final VoidCallback? onClearFilter;

  const _HistoryTab({
    required this.trainerId,
    required this.formatTime,
    this.filterClientEmail,
    this.filterClientName,
    this.onClearFilter,
  });

  @override
  State<_HistoryTab> createState() => _HistoryTabState();
}

class _HistoryTabState extends State<_HistoryTab> {
  final SupabaseService _supabaseService = SupabaseService();
  List<BookedSlot> _historySlots = [];
  bool _isLoading = true;

  @override
  void initState() {
    super.initState();
    _fetchHistory();
  }

  Future<void> _fetchHistory() async {
    try {
      final List<dynamic> rows = await _supabaseService.dbClient
          .from('trainer_appointments')
          .select('*')
          .eq('trainer_id', widget.trainerId)
          .order('appointment_date', ascending: false)
          .order('start_time', ascending: false);

      final List<BookedSlot> appts = rows
          .map((e) => BookedSlot.fromJson(e as Map<String, dynamic>))
          .toList();

      // Filter: Keep only slots that happened in the past (date/time has passed)
      final now = DateTime.now();
      final past = appts.where((s) {
        try {
          final slotDateTime = DateTime.parse('${s.slotDate}T${s.endTime}');
          return slotDateTime.isBefore(now);
        } catch (_) {
          final todayStr = now.toString().split(' ')[0];
          return s.slotDate.compareTo(todayStr) < 0;
        }
      }).toList();

      setState(() {
        _historySlots = past;
        _isLoading = false;
      });
    } catch (e) {
      debugPrint('Error fetching history: $e');
      setState(() => _isLoading = false);
    }
  }

  void _showSessionDetails(BookedSlot slot) {
    final isLight = Theme.of(context).brightness == Brightness.light;
    final labelColor = isLight ? AppColors.black : AppColors.textLight;
    final subLabelColor = isLight ? Colors.black54 : AppColors.textDim;
    final bottomSheetBg = isLight ? Colors.white : AppColors.nearBlack;
    final dividerColor = isLight ? Colors.black12 : Colors.white10;

    showModalBottomSheet(
      context: context,
      backgroundColor: bottomSheetBg,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      builder: (context) {
        return Padding(
          padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 20),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Center(
                child: Container(
                  width: 40,
                  height: 4,
                  margin: const EdgeInsets.only(bottom: 20),
                  decoration: BoxDecoration(
                    color: isLight ? Colors.black12 : Colors.white24,
                    borderRadius: BorderRadius.circular(2),
                  ),
                ),
              ),
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text(
                    'SESSION DETAILS',
                    style: TextStyle(
                      fontFamily: 'Archivo Black',
                      fontSize: 16,
                      color: labelColor,
                    ),
                  ),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                    decoration: BoxDecoration(
                      color: (isLight ? AppColors.limeDim : AppColors.lime).withValues(alpha: 0.15),
                      borderRadius: BorderRadius.circular(20),
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(Icons.check_circle, size: 12, color: isLight ? AppColors.limeDim : AppColors.lime),
                        const SizedBox(width: 4),
                        Text(
                          'Completed',
                          style: TextStyle(
                            color: isLight ? AppColors.limeDim : AppColors.lime,
                            fontSize: 11,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
              Divider(color: dividerColor, height: 24),
              
              // Client Info Section
              Text(
                'CLIENT',
                style: TextStyle(color: subLabelColor, fontSize: 11, fontWeight: FontWeight.bold),
              ),
              const SizedBox(height: 6),
              Row(
                children: [
                  CircleAvatar(
                    radius: 18,
                    backgroundColor: isLight ? Colors.black.withOpacity(0.05) : Colors.white10,
                    child: Icon(Icons.person, size: 20, color: labelColor),
                  ),
                  const SizedBox(width: 12),
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        slot.userName ?? 'Client',
                        style: TextStyle(
                          color: labelColor,
                          fontWeight: FontWeight.bold,
                          fontSize: 14,
                        ),
                      ),
                      Text(
                        slot.userEmail ?? 'N/A',
                        style: TextStyle(color: subLabelColor, fontSize: 12),
                      ),
                    ],
                  ),
                ],
              ),
              const SizedBox(height: 20),

              // Date/Time info
              Text(
                'DATE & TIME',
                style: TextStyle(color: subLabelColor, fontSize: 11, fontWeight: FontWeight.bold),
              ),
              const SizedBox(height: 6),
              Row(
                children: [
                  Icon(Icons.calendar_today, size: 16, color: isLight ? AppColors.limeDim : AppColors.lime),
                  const SizedBox(width: 8),
                  Text(
                    slot.slotDate,
                    style: TextStyle(color: labelColor, fontSize: 13),
                  ),
                  const SizedBox(width: 20),
                  Icon(Icons.access_time, size: 16, color: isLight ? AppColors.limeDim : AppColors.lime),
                  const SizedBox(width: 8),
                  Text(
                    '${widget.formatTime(slot.startTime)} - ${widget.formatTime(slot.endTime)}',
                    style: TextStyle(color: labelColor, fontSize: 13),
                  ),
                ],
              ),
              const SizedBox(height: 20),

              // Price
              Text(
                'SESSION RATE',
                style: TextStyle(color: subLabelColor, fontSize: 11, fontWeight: FontWeight.bold),
              ),
              const SizedBox(height: 6),
              Text(
                '\$${slot.price.toStringAsFixed(2)} USD',
                style: TextStyle(
                  color: labelColor,
                  fontWeight: FontWeight.bold,
                  fontSize: 16,
                  fontFamily: 'Archivo Black',
                ),
              ),
              const SizedBox(height: 24),

              // Close Button
              SizedBox(
                width: double.infinity,
                child: ElevatedButton(
                  onPressed: () => Navigator.of(context).pop(),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: isLight ? Colors.black.withOpacity(0.05) : Colors.white10,
                    foregroundColor: labelColor,
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(12),
                    ),
                    padding: const EdgeInsets.symmetric(vertical: 14),
                  ),
                  child: const Text('Close'),
                ),
              ),
            ],
          ),
        );
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    final isLight = Theme.of(context).brightness == Brightness.light;
    final labelColor = isLight ? AppColors.black : AppColors.textLight;
    final subLabelColor = isLight ? Colors.black54 : AppColors.textDim;
    final cardBgColor = isLight ? Colors.white : AppColors.nearBlack;
    final borderColor = isLight ? Colors.black12 : Colors.white10;

    final filteredHistorySlots = _historySlots.where((slot) {
      if (widget.filterClientEmail != null && widget.filterClientEmail!.isNotEmpty) {
        return slot.userEmail?.toLowerCase() == widget.filterClientEmail!.toLowerCase();
      }
      return true;
    }).toList();

    return RefreshIndicator(
      onRefresh: _fetchHistory,
      color: isLight ? AppColors.limeDim : AppColors.lime,
      child: ListView(
        padding: const EdgeInsets.all(20),
        children: [
          Text(
            'SESSION HISTORY',
            style: Theme.of(
              context,
            ).textTheme.displayMedium?.copyWith(
              fontSize: 22,
              color: labelColor,
            ),
          ),
          const SizedBox(height: 6),
          Text(
            'Completed and historical sessions archive.',
            style: TextStyle(color: subLabelColor, fontSize: 13),
          ),
          const SizedBox(height: 24),

          if (widget.filterClientEmail != null && widget.filterClientEmail!.isNotEmpty) ...[
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
              decoration: BoxDecoration(
                color: isLight ? AppColors.limeDim.withOpacity(0.1) : AppColors.lime.withOpacity(0.08),
                borderRadius: BorderRadius.circular(12),
                border: Border.all(
                  color: isLight ? AppColors.limeDim.withOpacity(0.3) : AppColors.lime.withOpacity(0.2),
                ),
              ),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Expanded(
                    child: Text(
                      'Filtered by: ${widget.filterClientName ?? widget.filterClientEmail}',
                      style: TextStyle(
                        color: isLight ? const Color(0xFF4E6600) : AppColors.lime,
                        fontWeight: FontWeight.bold,
                        fontSize: 12,
                      ),
                    ),
                  ),
                  GestureDetector(
                    onTap: widget.onClearFilter,
                    child: Icon(
                      Icons.cancel_outlined,
                      color: isLight ? const Color(0xFF4E6600) : AppColors.lime,
                      size: 18,
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 16),
          ],

          if (_isLoading)
            Center(
              child: CircularProgressIndicator(color: isLight ? AppColors.limeDim : AppColors.lime),
            )
          else if (filteredHistorySlots.isEmpty)
            Container(
              padding: const EdgeInsets.all(32),
              decoration: BoxDecoration(
                color: cardBgColor,
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: borderColor),
                boxShadow: isLight ? [
                  BoxShadow(
                    color: Colors.black.withOpacity(0.04),
                    blurRadius: 10,
                    offset: const Offset(0, 4),
                  )
                ] : null,
              ),
              child: Column(
                children: [
                  Icon(Icons.history, size: 48, color: subLabelColor),
                  const SizedBox(height: 16),
                  Text(
                    'No completed appointments found.',
                    style: TextStyle(color: subLabelColor, fontSize: 13),
                    textAlign: TextAlign.center,
                  ),
                ],
              ),
            )
          else
            ListView.separated(
              shrinkWrap: true,
              physics: const NeverScrollableScrollPhysics(),
              itemCount: filteredHistorySlots.length,
              separatorBuilder: (_, __) => const SizedBox(height: 10),
              itemBuilder: (context, index) {
                final slot = filteredHistorySlots[index];

                return InkWell(
                  onTap: () => _showSessionDetails(slot),
                  borderRadius: BorderRadius.circular(16),
                  child: Container(
                    decoration: BoxDecoration(
                      color: cardBgColor,
                      borderRadius: BorderRadius.circular(16),
                      border: Border.all(color: borderColor),
                      boxShadow: isLight ? [
                        BoxShadow(
                          color: Colors.black.withOpacity(0.03),
                          blurRadius: 8,
                          offset: const Offset(0, 2),
                        )
                      ] : null,
                    ),
                    padding: const EdgeInsets.all(16),
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              slot.userName ?? 'Client',
                              style: TextStyle(
                                color: labelColor,
                                fontWeight: FontWeight.bold,
                                fontSize: 14,
                              ),
                            ),
                            const SizedBox(height: 4),
                            Row(
                              children: [
                                Icon(
                                  Icons.calendar_month,
                                  size: 13,
                                  color: subLabelColor,
                                ),
                                const SizedBox(width: 4),
                                Text(
                                  slot.slotDate,
                                  style: TextStyle(
                                    color: subLabelColor,
                                    fontSize: 12,
                                  ),
                                ),
                                const SizedBox(width: 12),
                                Icon(
                                  Icons.access_time,
                                  size: 13,
                                  color: subLabelColor,
                                ),
                                const SizedBox(width: 4),
                                Text(
                                  '${widget.formatTime(slot.startTime)} - ${widget.formatTime(slot.endTime)}',
                                  style: TextStyle(
                                    color: subLabelColor,
                                    fontSize: 11,
                                  ),
                                ),
                              ],
                            ),
                          ],
                        ),
                        Text(
                          '\$${slot.price.toStringAsFixed(0)}',
                          style: TextStyle(
                            color: isLight ? AppColors.limeDim : AppColors.lime,
                            fontWeight: FontWeight.bold,
                            fontSize: 14,
                          ),
                        ),
                      ],
                    ),
                  ),
                );
              },
            ),
        ],
      ),
    );
  }
}

// ----------------------------------------------------------------------
// 5. PROFILE TAB (SETTINGS & PHOTO PICK / CROP)
// ----------------------------------------------------------------------
class _ProfileTab extends StatefulWidget {
  final Trainer trainer;
  final ValueChanged<Trainer> onProfileUpdated;
  final VoidCallback onLogout;

  const _ProfileTab({
    required this.trainer,
    required this.onProfileUpdated,
    required this.onLogout,
  });

  @override
  State<_ProfileTab> createState() => _ProfileTabState();
}

class _ProfileTabState extends State<_ProfileTab> {
  final SupabaseService _supabaseService = SupabaseService();

  final _experienceController = TextEditingController();
  final _trainingTypeController = TextEditingController();
  final _priceController = TextEditingController();
  final _phoneController = TextEditingController();
  final _emailController = TextEditingController();
  final _bioController = TextEditingController();

  bool _isSaving = false;
  String? _phoneError;
  String? _priceError;

  @override
  void initState() {
    super.initState();
    _experienceController.text = widget.trainer.experience;
    _trainingTypeController.text = widget.trainer.trainingType;
    _priceController.text = widget.trainer.sessionPrice.toString();
    _phoneController.text = widget.trainer.phoneNumber != null
        ? (widget.trainer.phoneNumber!.startsWith('+92')
              ? widget.trainer.phoneNumber!.substring(3)
              : widget.trainer.phoneNumber!)
        : '';
    _emailController.text = widget.trainer.email;
    _bioController.text = widget.trainer.bio ?? '';
  }

  @override
  void didUpdateWidget(covariant _ProfileTab oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (widget.trainer != oldWidget.trainer) {
      _experienceController.text = widget.trainer.experience;
      _trainingTypeController.text = widget.trainer.trainingType;
      _priceController.text = widget.trainer.sessionPrice.toString();
      _phoneController.text = widget.trainer.phoneNumber != null
          ? (widget.trainer.phoneNumber!.startsWith('+92')
                ? widget.trainer.phoneNumber!.substring(3)
                : widget.trainer.phoneNumber!)
          : '';
      _emailController.text = widget.trainer.email;
      _bioController.text = widget.trainer.bio ?? '';
    }
  }

  @override
  void dispose() {
    _experienceController.dispose();
    _trainingTypeController.dispose();
    _priceController.dispose();
    _phoneController.dispose();
    _emailController.dispose();
    _bioController.dispose();
    super.dispose();
  }

  Future<void> _pickAndUploadImage() async {
    final picker = ImagePicker();
    final pickedFile = await picker.pickImage(source: ImageSource.gallery);
    if (pickedFile == null) return;

    final bytes = await pickedFile.readAsBytes();
    final extension = pickedFile.path.split('.').last;

    if (!mounted) return;

    // Show Custom premium Cropping Preview Dialog (Interactive drag and zoom)
    final result = await showDialog<Map<String, dynamic>>(
      context: context,
      barrierDismissible: false,
      builder: (context) {
        double scale = 1.0;
        Offset offset = Offset.zero;

        return StatefulBuilder(
          builder: (context, setDialogState) {
            return Dialog(
              backgroundColor: Colors.transparent,
              child: Container(
                decoration: BoxDecoration(
                  gradient: AppColors.cardGrad,
                  borderRadius: BorderRadius.circular(24),
                  border: Border.all(color: AppColors.inputBorder),
                ),
                padding: const EdgeInsets.all(20),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    const Text(
                      'Crop Profile Photo',
                      style: TextStyle(
                        fontFamily: 'Archivo Black',
                        fontSize: 16,
                        color: AppColors.textLight,
                      ),
                    ),
                    const SizedBox(height: 16),
                    // Circular image crop preview bounding area
                    Container(
                      width: 200,
                      height: 200,
                      decoration: const BoxDecoration(
                        shape: BoxShape.circle,
                        color: Colors.black26,
                      ),
                      clipBehavior: Clip.hardEdge,
                      child: GestureDetector(
                        onPanUpdate: (details) {
                          setDialogState(() {
                            offset += details.delta;
                          });
                        },
                        child: Transform.translate(
                          offset: offset,
                          child: Transform.scale(
                            scale: scale,
                            child: Image.memory(bytes, fit: BoxFit.cover),
                          ),
                        ),
                      ),
                    ),
                    const SizedBox(height: 16),
                    // Zoom Slider widget
                    Row(
                      children: [
                        const Icon(
                          Icons.zoom_out,
                          size: 16,
                          color: AppColors.textDim,
                        ),
                        Expanded(
                          child: Slider(
                            value: scale,
                            min: 1.0,
                            max: 3.0,
                            activeColor: AppColors.lime,
                            inactiveColor: Colors.white10,
                            onChanged: (val) {
                              setDialogState(() {
                                scale = val;
                              });
                            },
                          ),
                        ),
                        const Icon(
                          Icons.zoom_in,
                          size: 16,
                          color: AppColors.textDim,
                        ),
                      ],
                    ),
                    const SizedBox(height: 16),
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        TextButton(
                          onPressed: () => Navigator.of(context).pop(),
                          child: const Text(
                            'Cancel',
                            style: TextStyle(color: Colors.white70),
                          ),
                        ),
                        ElevatedButton(
                          onPressed: () {
                            Navigator.of(context).pop({
                              'confirmed': true,
                              // In mobile we pick image, interactive zoom coordinates mapped on server
                              // We will save and upload bytes directly
                            });
                          },
                          style: ElevatedButton.styleFrom(
                            backgroundColor: AppColors.lime,
                            foregroundColor: AppColors.black,
                          ),
                          child: const Text(
                            'Confirm',
                            style: TextStyle(fontWeight: FontWeight.bold),
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            );
          },
        );
      },
    );

    if (result != null && result['confirmed'] == true) {
      setState(() => _isSaving = true);
      try {
        final publicUrl = await _supabaseService.uploadAvatar(
          userId: widget.trainer.id,
          imageBytes: bytes,
          fileExtension: extension,
          mimeType: 'image/$extension',
        );

        // Update profile in DB
        final updated = await _supabaseService.updateTrainerProfile(widget.trainer.id, {
          'image_url': publicUrl,
        });
        widget.onProfileUpdated(updated);
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('Avatar uploaded successfully!')),
          );
        }
      } catch (e) {
        if (mounted) {
          ScaffoldMessenger.of(
            context,
          ).showSnackBar(SnackBar(content: Text('Failed to upload image: $e')));
        }
      } finally {
        if (mounted) setState(() => _isSaving = false);
      }
    }
  }

  Future<void> _showBioDialog(BuildContext context) async {
    final isLight = Theme.of(context).brightness == Brightness.light;
    final localBioController = TextEditingController(text: _bioController.text);
    final labelColor = isLight ? AppColors.black : AppColors.textLight;
    final inputTextColor = isLight ? AppColors.black : AppColors.textLight;

    final updatedBio = await showDialog<String>(
      context: context,
      builder: (context) {
        return AlertDialog(
          backgroundColor: isLight ? Colors.white : AppColors.nearBlack,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(16),
            side: BorderSide(
              color: isLight ? Colors.black12 : Colors.white10,
            ),
          ),
          title: Text(
            'Edit Biography',
            style: TextStyle(
              color: labelColor,
              fontWeight: FontWeight.bold,
              fontSize: 18,
            ),
          ),
          content: SizedBox(
            width: MediaQuery.of(context).size.width * 0.9,
            child: TextField(
              controller: localBioController,
              maxLines: 8,
              maxLength: 500,
              style: TextStyle(
                color: inputTextColor,
                fontSize: 13,
              ),
              decoration: InputDecoration(
                hintText: 'Tell clients about your background, credentials, and training philosophy...',
                hintStyle: TextStyle(
                  color: isLight ? Colors.black38 : AppColors.textDim,
                ),
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(12),
                ),
              ),
            ),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(context),
              child: const Text(
                'Cancel',
                style: TextStyle(color: Colors.redAccent, fontWeight: FontWeight.bold),
              ),
            ),
            ElevatedButton(
              onPressed: () {
                Navigator.pop(context, localBioController.text.trim());
              },
              style: ElevatedButton.styleFrom(
                backgroundColor: isLight ? AppColors.limeDim : AppColors.lime,
                foregroundColor: isLight ? Colors.white : AppColors.black,
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(8),
                ),
              ),
              child: const Text('Confirm', style: TextStyle(fontWeight: FontWeight.bold)),
            ),
          ],
        );
      },
    );

    if (updatedBio != null) {
      setState(() {
        _bioController.text = updatedBio;
      });
    }
  }

  Future<void> _handleSave() async {
    final experience = _experienceController.text.trim();
    final trainingType = _trainingTypeController.text.trim();
    final priceStr = _priceController.text.trim();
    final phone = _phoneController.text.trim();
    final bio = _bioController.text.trim();

    // Validations
    double? price = double.tryParse(priceStr);
    if (price == null || price <= 0) {
      setState(() => _priceError = 'Please enter a valid price.');
      return;
    } else {
      setState(() => _priceError = null);
    }

    if (phone.isNotEmpty && !RegExp(r'^3\d{9}$').hasMatch(phone)) {
      setState(
        () => _phoneError =
            'Please enter a valid 10-digit number starting with 3.',
      );
      return;
    } else {
      setState(() => _phoneError = null);
    }

    final String formattedPhone = phone.isNotEmpty ? '+92$phone' : '';

    final Map<String, dynamic> updates = {};
    if (experience != widget.trainer.experience) {
      updates['experience'] = experience;
    }
    if (trainingType != widget.trainer.trainingType) {
      updates['training_type'] = trainingType;
    }
    if (price != widget.trainer.sessionPrice) {
      updates['session_price'] = price;
    }
    final String currentPhone = widget.trainer.phoneNumber ?? '';
    if (formattedPhone != currentPhone) {
      updates['phone_number'] = formattedPhone.isNotEmpty ? formattedPhone : null;
    }
    final String currentBio = widget.trainer.bio ?? '';
    if (bio != currentBio) {
      updates['bio'] = bio.isNotEmpty ? bio : null;
    }

    if (updates.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('No changes to save.')),
      );
      return;
    }

    setState(() => _isSaving = true);

    try {
      final updated = await _supabaseService.updateTrainerProfile(widget.trainer.id, updates);

      widget.onProfileUpdated(updated);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Profile saved successfully!')),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(SnackBar(content: Text('Failed to save profile: $e')));
      }
    } finally {
      if (mounted) setState(() => _isSaving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final isLight = Theme.of(context).brightness == Brightness.light;
    final labelColor = isLight ? AppColors.black : AppColors.textLight;
    final subLabelColor = isLight ? Colors.black54 : AppColors.textDim;
    final inputTextColor = isLight ? AppColors.black : AppColors.textLight;

    return ListView(
      padding: const EdgeInsets.all(20),
      children: [
        Text(
          'PROFILE CONFIGURATION',
          style: Theme.of(
            context,
          ).textTheme.displayMedium?.copyWith(
            fontSize: 22,
            color: labelColor,
          ),
        ),
        const SizedBox(height: 6),
        Text(
          'Configure your trainer bio, session rates, and profile picture.',
          style: TextStyle(color: subLabelColor, fontSize: 13),
        ),
        const SizedBox(height: 24),

        // Avatar Profile Selection Box
        Center(
          child: Column(
            children: [
              GestureDetector(
                onTap: _pickAndUploadImage,
                child: Stack(
                  children: [
                    CircleAvatar(
                      radius: 52,
                      backgroundColor: isLight ? Colors.black.withOpacity(0.05) : AppColors.nearBlack,
                      backgroundImage: widget.trainer.imageUrl != null
                          ? NetworkImage(widget.trainer.imageUrl!)
                          : null,
                      child: widget.trainer.imageUrl == null
                          ? Icon(
                              Icons.person,
                              size: 48,
                              color: subLabelColor,
                            )
                          : null,
                    ),
                    Positioned(
                      bottom: 0,
                      right: 0,
                      child: Container(
                        decoration: const BoxDecoration(
                          shape: BoxShape.circle,
                          color: AppColors.lime,
                        ),
                        padding: const EdgeInsets.all(8),
                        child: const Icon(
                          Icons.camera_alt,
                          color: AppColors.black,
                          size: 16,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 10),
              Text(
                widget.trainer.name.toUpperCase(),
                style: TextStyle(
                  fontWeight: FontWeight.bold,
                  fontSize: 16,
                  fontFamily: 'Archivo Black',
                  color: labelColor,
                ),
              ),
              Text(
                widget.trainer.email,
                style: TextStyle(color: subLabelColor, fontSize: 12),
              ),
              const SizedBox(height: 6),
              TextButton.icon(
                onPressed: _pickAndUploadImage,
                icon: Icon(Icons.photo_library, color: isLight ? AppColors.limeDim : AppColors.lime, size: 16),
                label: Text(
                  'Change Profile Picture',
                  style: TextStyle(
                    color: isLight ? AppColors.limeDim : AppColors.lime,
                    fontWeight: FontWeight.bold,
                    fontSize: 13,
                  ),
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 32),

        // Editable Input Fields
        Text(
          'Years of Experience',
          style: TextStyle(
            color: labelColor,
            fontSize: 12,
            fontWeight: FontWeight.bold,
          ),
        ),
        const SizedBox(height: 6),
        TextField(
          controller: _experienceController,
          style: TextStyle(color: inputTextColor, fontSize: 13),
          decoration: InputDecoration(
            hintText: 'e.g. 5 years',
            hintStyle: TextStyle(color: isLight ? Colors.black38 : AppColors.textDim),
          ),
        ),
        const SizedBox(height: 16),

        Text(
          'Training Type',
          style: TextStyle(
            color: labelColor,
            fontSize: 12,
            fontWeight: FontWeight.bold,
          ),
        ),
        const SizedBox(height: 6),
        TextField(
          controller: _trainingTypeController,
          style: TextStyle(color: inputTextColor, fontSize: 13),
          decoration: InputDecoration(
            hintText: 'e.g. Strength & Conditioning',
            hintStyle: TextStyle(color: isLight ? Colors.black38 : AppColors.textDim),
          ),
        ),
        const SizedBox(height: 16),

        Text(
          'Session Price (USD/hour)',
          style: TextStyle(
            color: labelColor,
            fontSize: 12,
            fontWeight: FontWeight.bold,
          ),
        ),
        const SizedBox(height: 6),
        TextField(
          controller: _priceController,
          keyboardType: TextInputType.number,
          style: TextStyle(color: inputTextColor, fontSize: 13),
          decoration: InputDecoration(
            hintText: 'e.g. 48.00',
            hintStyle: TextStyle(color: isLight ? Colors.black38 : AppColors.textDim),
            errorText: _priceError,
          ),
        ),
        const SizedBox(height: 16),

        Text(
          'Mobile Number (PK)',
          style: TextStyle(
            color: labelColor,
            fontSize: 12,
            fontWeight: FontWeight.bold,
          ),
        ),
        const SizedBox(height: 6),
        TextField(
          controller: _phoneController,
          keyboardType: TextInputType.phone,
          maxLength: 10,
          style: TextStyle(color: inputTextColor, fontSize: 13),
          decoration: InputDecoration(
            counterText: '',
            prefixText: '+92 ',
            prefixStyle: TextStyle(
              color: labelColor,
              fontWeight: FontWeight.bold,
              fontSize: 13,
            ),
            hintText: '3XXXXXXXXX',
            hintStyle: TextStyle(color: isLight ? Colors.black38 : AppColors.textDim),
            errorText: _phoneError,
          ),
        ),
        const SizedBox(height: 16),

        Text(
          'Biography',
          style: TextStyle(
            color: labelColor,
            fontSize: 12,
            fontWeight: FontWeight.bold,
          ),
        ),
        const SizedBox(height: 6),
        Container(
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(
            color: isLight ? Colors.black.withOpacity(0.02) : AppColors.nearBlack,
            borderRadius: BorderRadius.circular(12),
            border: Border.all(
              color: isLight ? Colors.black12 : Colors.white10,
            ),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                _bioController.text.isEmpty
                    ? 'No biography added yet. Click below to add your bio.'
                    : _bioController.text,
                style: TextStyle(
                  color: _bioController.text.isEmpty
                      ? subLabelColor
                      : inputTextColor,
                  fontSize: 13,
                  height: 1.4,
                ),
                maxLines: 4,
                overflow: TextOverflow.ellipsis,
              ),
              const SizedBox(height: 10),
              ElevatedButton.icon(
                onPressed: () => _showBioDialog(context),
                icon: const Icon(Icons.edit_note, size: 18),
                label: const Text('Edit Bio'),
                style: ElevatedButton.styleFrom(
                  backgroundColor: isLight ? AppColors.limeDim.withOpacity(0.1) : AppColors.lime.withOpacity(0.1),
                  foregroundColor: isLight ? AppColors.limeDim : AppColors.lime,
                  elevation: 0,
                  padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(8),
                  ),
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 32),

        // Action Buttons: Save & Logout
        ElevatedButton(
          onPressed: _isSaving ? null : _handleSave,
          style: ElevatedButton.styleFrom(
            backgroundColor: isLight ? AppColors.limeDim : AppColors.lime,
            foregroundColor: isLight ? Colors.white : AppColors.black,
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(12),
            ),
            padding: const EdgeInsets.symmetric(vertical: 14),
          ),
          child: Text(
            _isSaving ? 'Saving...' : 'Save',
            style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14),
          ),
        ),
        const SizedBox(height: 12),
        OutlinedButton(
          onPressed: _isSaving ? null : widget.onLogout,
          style: OutlinedButton.styleFrom(
            foregroundColor: Colors.redAccent,
            side: const BorderSide(color: Colors.redAccent),
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(12),
            ),
            padding: const EdgeInsets.symmetric(vertical: 14),
          ),
          child: const Text(
            'Log Out Account',
            style: TextStyle(fontWeight: FontWeight.bold, fontSize: 14),
          ),
        ),
      ],
    );
  }
}
