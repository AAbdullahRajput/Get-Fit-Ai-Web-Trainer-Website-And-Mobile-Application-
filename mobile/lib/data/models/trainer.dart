class Trainer {
  final String id;
  final String email;
  final String name;
  final String? phoneNumber;
  final String trainingType;
  final String experience;
  final String? imageUrl;
  final double sessionPrice;
  final String? bio;

  Trainer({
    required this.id,
    required this.email,
    required this.name,
    this.phoneNumber,
    required this.trainingType,
    required this.experience,
    this.imageUrl,
    required this.sessionPrice,
    this.bio,
  });

  factory Trainer.fromJson(Map<String, dynamic> json) {
    // Parse session_price which might be double, int, or string in database
    double parsedPrice = 48.00;
    if (json['session_price'] != null) {
      parsedPrice = double.tryParse(json['session_price'].toString()) ?? 48.00;
    }

    return Trainer(
      id: json['id'] as String,
      email: json['email'] as String,
      name: json['name'] as String,
      phoneNumber: json['phone_number'] as String?,
      trainingType: json['training_type'] as String? ?? 'General',
      experience: json['experience'] as String? ?? '0 years',
      imageUrl: json['image_url'] as String?,
      sessionPrice: parsedPrice,
      bio: json['bio'] as String?,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'email': email,
      'name': name,
      'phone_number': phoneNumber,
      'training_type': trainingType,
      'experience': experience,
      'image_url': imageUrl,
      'session_price': sessionPrice,
      'bio': bio,
    };
  }

  Trainer copyWith({
    String? id,
    String? email,
    String? name,
    String? phoneNumber,
    String? trainingType,
    String? experience,
    String? imageUrl,
    double? sessionPrice,
    String? bio,
  }) {
    return Trainer(
      id: id ?? this.id,
      email: email ?? this.email,
      name: name ?? this.name,
      phoneNumber: phoneNumber ?? this.phoneNumber,
      trainingType: trainingType ?? this.trainingType,
      experience: experience ?? this.experience,
      imageUrl: imageUrl ?? this.imageUrl,
      sessionPrice: sessionPrice ?? this.sessionPrice,
      bio: bio ?? this.bio,
    );
  }
}
