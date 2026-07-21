class TrainerSlot {
  final String id;
  final String trainerId;
  final String slotDate;
  final String startTime;
  final String endTime;
  final double price;
  final String status;
  final bool isActive;
  final String? bookedByUserId;
  final String? bookedByName;
  final String? bookedByEmail;
  final bool virtual;

  TrainerSlot({
    required this.id,
    required this.trainerId,
    required this.slotDate,
    required this.startTime,
    required this.endTime,
    required this.price,
    required this.status,
    required this.isActive,
    this.bookedByUserId,
    this.bookedByName,
    this.bookedByEmail,
    this.virtual = false,
  });

  factory TrainerSlot.fromJson(Map<String, dynamic> json) {
    return TrainerSlot(
      id: json['id'].toString(),
      trainerId: json['trainer_id'] as String,
      slotDate: json['slot_date'] as String,
      startTime: json['start_time'] as String,
      endTime: json['end_time'] as String,
      price: double.tryParse(json['price'].toString()) ?? 48.00,
      status: json['status'] as String? ?? 'available',
      isActive: json['is_active'] as bool? ?? true,
      bookedByUserId: json['booked_by_user_id'] as String?,
      bookedByName: json['booked_by_name'] as String?,
      bookedByEmail: json['booked_by_email'] as String?,
      virtual: json['virtual'] as bool? ?? false,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'trainer_id': trainerId,
      'slot_date': slotDate,
      'start_time': startTime,
      'end_time': endTime,
      'price': price,
      'status': status,
      'is_active': isActive,
      'booked_by_user_id': bookedByUserId,
      'booked_by_name': bookedByName,
      'booked_by_email': bookedByEmail,
    };
  }

  TrainerSlot copyWith({
    String? id,
    String? trainerId,
    String? slotDate,
    String? startTime,
    String? endTime,
    double? price,
    String? status,
    bool? isActive,
    String? bookedByUserId,
    String? bookedByName,
    String? bookedByEmail,
    bool? virtual,
  }) {
    return TrainerSlot(
      id: id ?? this.id,
      trainerId: trainerId ?? this.trainerId,
      slotDate: slotDate ?? this.slotDate,
      startTime: startTime ?? this.startTime,
      endTime: endTime ?? this.endTime,
      price: price ?? this.price,
      status: status ?? this.status,
      isActive: isActive ?? this.isActive,
      bookedByUserId: bookedByUserId ?? this.bookedByUserId,
      bookedByName: bookedByName ?? this.bookedByName,
      bookedByEmail: bookedByEmail ?? this.bookedByEmail,
      virtual: virtual ?? this.virtual,
    );
  }
}
