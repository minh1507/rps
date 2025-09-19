package vn.vnpay.rs.berps.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.stereotype.Service;
import vn.vnpay.rs.berps.dto.CompletedPartDto;
import software.amazon.awssdk.services.s3.model.CompletedPart;

import java.time.Duration;
import java.util.List;
import java.util.stream.Collectors;

@Service
public class UploadPartRedisService {
    private final RedisTemplate<String, String> redisTemplate;

    private final ObjectMapper objectMapper = new ObjectMapper();

    private static final Duration TTL = Duration.ofMinutes(30);

    public UploadPartRedisService(RedisTemplate<String, String> redisTemplate) {
        this.redisTemplate = redisTemplate;
    }

    private String getKey(String uploadId) {
        return "upload:parts:" + uploadId;
    }

    public void addPart(String uploadId, CompletedPart part) throws JsonProcessingException {
        CompletedPartDto dto = CompletedPartDto.fromCompletedPart(part);
        String value = objectMapper.writeValueAsString(dto);
        redisTemplate.opsForList().rightPush(getKey(uploadId), value);
        redisTemplate.expire(getKey(uploadId), TTL); // set TTL
    }

    public List<CompletedPart> getParts(String uploadId) throws JsonProcessingException {
        List<String> values = redisTemplate.opsForList().range(getKey(uploadId), 0, -1);
        if (values == null) return List.of();

        return values.stream()
                .map(val -> {
                    try {
                        CompletedPartDto dto = objectMapper.readValue(val, CompletedPartDto.class);
                        return dto.toCompletedPart();
                    } catch (JsonProcessingException e) {
                        throw new RuntimeException(e);
                    }
                })
                .collect(Collectors.toList());
    }

    public void removeUpload(String uploadId) {
        redisTemplate.delete(getKey(uploadId));
    }
}
