package vn.vnpay.rs.berps.service.Impl;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;
import software.amazon.awssdk.core.ResponseBytes;
import software.amazon.awssdk.core.sync.RequestBody;
import software.amazon.awssdk.core.sync.ResponseTransformer;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.*;
import vn.vnpay.rs.berps.service.MinioService;
import vn.vnpay.rs.berps.service.UploadPartRedisService;

import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.OutputStream;
import java.util.Comparator;
import java.util.List;
import java.util.stream.Collectors;

@Service
public class MinioServiceImpl implements MinioService {

    private final S3Client s3Client;
    private final UploadPartRedisService uploadPartRedisService;

    @Value("${minio.bucket}")
    private String bucket;

    public MinioServiceImpl(S3Client s3Client, UploadPartRedisService uploadPartRedisService) {
        this.s3Client = s3Client;
        this.uploadPartRedisService = uploadPartRedisService;
    }

    @Override
    public String initiateMultipartUpload(String fileName) {
        CreateMultipartUploadResponse response = s3Client.createMultipartUpload(
                CreateMultipartUploadRequest.builder()
                        .bucket(bucket)
                        .key(fileName)
                        .build()
        );
        return response.uploadId();
    }

    @Override
    public String uploadPart(String fileName, String uploadId, int partNumber, MultipartFile file) throws IOException {
        UploadPartResponse response = s3Client.uploadPart(
                UploadPartRequest.builder()
                        .bucket(bucket)
                        .key(fileName)
                        .uploadId(uploadId)
                        .partNumber(partNumber)
                        .contentLength(file.getSize())
                        .build(),
                RequestBody.fromBytes(file.getBytes())
        );

        // Lưu vào Redis
        uploadPartRedisService.addPart(uploadId, CompletedPart.builder()
                .partNumber(partNumber)
                .eTag(response.eTag())
                .build());

        return response.eTag();
    }

    @Override
    public String completeMultipartUpload(String fileName, String uploadId) {
        try {
            List<CompletedPart> parts = uploadPartRedisService.getParts(uploadId);

            if (parts.isEmpty()) {
                throw new IllegalStateException("No uploaded parts found for uploadId: " + uploadId);
            }

            List<CompletedPart> sortedParts = parts.stream()
                    .sorted(Comparator.comparingInt(CompletedPart::partNumber))
                    .collect(Collectors.toList());

            for (int i = 0; i < sortedParts.size(); i++) {
                if (sortedParts.get(i).partNumber() != i + 1) {
                    uploadPartRedisService.removeUpload(uploadId);
                    throw new IllegalStateException("Missing part(s) detected. Complete upload aborted.");
                }
            }

            CompletedMultipartUpload completedMultipartUpload = CompletedMultipartUpload.builder()
                    .parts(sortedParts)
                    .build();

            CompleteMultipartUploadResponse response = s3Client.completeMultipartUpload(
                    CompleteMultipartUploadRequest.builder()
                            .bucket(bucket)
                            .key(fileName)
                            .uploadId(uploadId)
                            .multipartUpload(completedMultipartUpload)
                            .build()
            );

            uploadPartRedisService.removeUpload(uploadId);

            return response.location();

        } catch (Exception e) {
            throw new RuntimeException("Complete multipart upload failed", e);
        }
    }

    @Override
    public void downloadFile(String fileName, OutputStream outputStream) throws IOException {
        // Lấy tổng kích thước file (nếu cần cho logging hoặc progress)
        HeadObjectResponse headObject = s3Client.headObject(
                HeadObjectRequest.builder()
                        .bucket(bucket)
                        .key(fileName)
                        .build()
        );

        long totalSize = headObject.contentLength();
        long chunkSize = 5 * 1024 * 1024; // 5MB, dùng cho logging hoặc nếu muốn chia chunk nhỏ

        long bytesDownloaded = 0;
        int partNumber = 0;

        while (bytesDownloaded < totalSize) {
            long start = bytesDownloaded;
            long end = Math.min(start + chunkSize - 1, totalSize - 1);

            GetObjectRequest getRequest = GetObjectRequest.builder()
                    .bucket(bucket)
                    .key(fileName)
                    .range("bytes=" + start + "-" + end) // tải từng chunk
                    .build();

            // Stream trực tiếp chunk từ S3 vào outputStream, không giữ chunk trong RAM
            s3Client.getObject(getRequest, ResponseTransformer.toOutputStream(outputStream));

            bytesDownloaded += (end - start + 1);
            partNumber++;
        }
    }
}
