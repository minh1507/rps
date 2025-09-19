package vn.vnpay.rs.berps.controller;


import jakarta.servlet.http.HttpServletResponse;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import vn.vnpay.rs.berps.dto.ApiResponse;
import vn.vnpay.rs.berps.service.MinioService;

import java.io.IOException;
import java.util.Map;

@RestController()
@RequestMapping("/v1/file")
public class FileController {
    private final MinioService minioService;

    public FileController(MinioService minioService) {
        this.minioService = minioService;
    }

    @PostMapping(value = "/upload", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<ApiResponse<Void>> upload() {
        return ResponseEntity.ok(new ApiResponse<>(true, "File uploaded successfully", null));
    }

    @PostMapping("/init")
    public Map<String, String> initiateUpload(@RequestParam String fileName) {
        String uploadId = minioService.initiateMultipartUpload(fileName);
        return Map.of("uploadId", uploadId);
    }

    @PostMapping("/part")
    public Map<String, String> uploadPart(
            @RequestParam String fileName,
            @RequestParam String uploadId,
            @RequestParam int partNumber,
            @RequestParam("file") MultipartFile file
    ) throws IOException {
        String eTag = minioService.uploadPart(fileName, uploadId, partNumber, file);
        return Map.of("eTag", eTag);
    }

    @PostMapping("/complete")
    public Map<String, String> completeUpload(
            @RequestParam String fileName,
            @RequestParam String uploadId
    ) {
        String location = minioService.completeMultipartUpload(fileName, uploadId);
        return Map.of("location", location);
    }

    @GetMapping("/download")
    public void downloadFile(
            @RequestParam String fileName,
            HttpServletResponse response
    ) throws IOException {
        response.setContentType("application/octet-stream");
        response.setHeader("Content-Disposition", "attachment; filename=\"" + fileName + "\"");

        minioService.downloadFile(fileName, response.getOutputStream());
    }
}
