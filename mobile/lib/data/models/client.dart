class BookedSlot {
  final String id;
  final String slotDate;
  final String startTime;
  final String endTime;
  final double price;
  final String status;
  final String? userName;
  final String? userEmail;

  BookedSlot({
    required this.id,
    required this.slotDate,
    required this.startTime,
    required this.endTime,
    required this.price,
    required this.status,
    this.userName,
    this.userEmail,
  });

  factory BookedSlot.fromJson(Map<String, dynamic> json) {
    return BookedSlot(
      id: json['id'].toString(),
      slotDate: (json['slot_date'] ?? json['appointment_date']) as String,
      startTime: json['start_time'] as String,
      endTime: json['end_time'] as String,
      price: double.tryParse(json['price'].toString()) ?? 48.00,
      status: json['status'] as String? ?? 'confirmed',
      userName: json['user_name'] as String?,
      userEmail: json['user_email'] as String?,
    );
  }
}

class Client {
  final String? id;
  final String name;
  final String email;
  final String mobileNo;
  final String avatarUrl;
  final List<BookedSlot> bookedSlots;

  Client({
    this.id,
    required this.name,
    required this.email,
    required this.mobileNo,
    required this.avatarUrl,
    required this.bookedSlots,
  });

  factory Client.fromJson(Map<String, dynamic> json, List<BookedSlot> bookedSlots) {
    return Client(
      id: json['id'] as String?,
      name: json['name'] as String? ?? 'Client',
      email: json['email'] as String? ?? '',
      mobileNo: json['mobile_no'] as String? ?? 'N/A',
      avatarUrl: json['avatar_url'] as String? ?? '',
      bookedSlots: bookedSlots,
    );
  }
}
