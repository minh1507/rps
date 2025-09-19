package vn.vnpay.rs.berps.service;

import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.io.OutputStream;

public interface MinioService {
    String initiateMultipartUpload(String fileName);

    /** Upload từng part */
    String uploadPart(String fileName, String uploadId, int partNumber, MultipartFile file) throws IOException;

    /** Hoàn tất multipart upload */
    String completeMultipartUpload(String fileName, String uploadId);

    void downloadFile(String fileName, OutputStream outputStream) throws IOException;
}
