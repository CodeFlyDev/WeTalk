package com.wetalk.message.repository;

import com.wetalk.message.document.WhiteboardDoc;
import org.springframework.data.mongodb.repository.MongoRepository;

public interface WhiteboardRepository extends MongoRepository<WhiteboardDoc, String> {
}
